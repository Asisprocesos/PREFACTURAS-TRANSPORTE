"use server";

import { revalidatePath } from "next/cache";

import { defaultAppConfig } from "@/config/app.config";
import { interpolarPlantilla } from "@/lib/email/plantilla";
import { requireRole } from "@/lib/auth/roles";
import { obtenerGuiasPrefactura, registrarLogEjecucion } from "@/lib/log-ejecucion/registrar";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";
import { obtenerPrefactura } from "@/lib/prefacturas/queries";
import { generarYGuardarPdf } from "@/pdf/generar-y-guardar";

import { construirVariablesPlantilla } from "./plantilla-variables";
import { obtenerContactosPrefactura } from "./queries";
import { crearZipPrefacturas } from "./zip";

async function obtenerPdfVigenteOGenerar(
  prefacturaId: string,
  usuarioId: string,
): Promise<{ ok: true; buffer: Buffer; nombreArchivo: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documento_pdf")
    .select("storage_key, nombre_archivo")
    .eq("prefactura_id", prefacturaId)
    .eq("estado", "VIGENTE")
    .maybeSingle();

  if (doc) {
    const { data: blob, error } = await supabase.storage.from("prefacturas").download(doc.storage_key);
    if (error || !blob) return { ok: false, error: "No se pudo descargar el PDF vigente." };
    const buffer = Buffer.from(await blob.arrayBuffer());
    return { ok: true, buffer, nombreArchivo: doc.nombre_archivo };
  }

  const generado = await generarYGuardarPdf(prefacturaId, usuarioId);
  if (!generado.ok || !generado.buffer || !generado.nombreArchivo) {
    return { ok: false, error: generado.error ?? "No se pudo generar el PDF." };
  }
  return { ok: true, buffer: generado.buffer, nombreArchivo: generado.nombreArchivo };
}

export async function enviarCorreoIndividualAction(
  prefacturaId: string,
  datos: { to: string[]; cc: string[]; asunto: string; cuerpo: string },
): Promise<ResultadoAccion> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  if (datos.to.length === 0) return { ok: false, error: "Ingresa al menos un correo principal." };

  try {
    const prefactura = await obtenerPrefactura(prefacturaId);
    if (!prefactura) return { ok: false, error: "Prefactura no encontrada." };

    const pdf = await obtenerPdfVigenteOGenerar(prefacturaId, perfil.userId);
    if (!pdf.ok) return { ok: false, error: pdf.error };

    // obtenerEmailProvider() lanza si faltan las variables SMTP_* o
    // EMAIL_TEST_RECIPIENT — sin este try/catch esa excepción se propagaba
    // sin capturar hasta el cliente, y el botón "Enviar" se quedaba en
    // "Enviando..." para siempre porque nunca llegaba a limpiar su estado.
    const { obtenerEmailProvider } = await import("@/lib/email/provider");
    const proveedor = obtenerEmailProvider();
    const resultado = await proveedor.enviar({
      to: datos.to,
      cc: datos.cc,
      asunto: datos.asunto,
      cuerpo: datos.cuerpo,
      adjuntos: [{ nombreArchivo: pdf.nombreArchivo, contenido: pdf.buffer, contentType: "application/pdf" }],
    });

    const supabase = await createClient();
    const { data: envio } = await supabase
      .from("envio_correo")
      .insert({
        prefactura_id: prefacturaId,
        destinatarios_to: datos.to,
        destinatarios_cc: datos.cc,
        asunto: datos.asunto,
        cuerpo: datos.cuerpo,
        estado: resultado.ok ? "ENVIADO" : "ERROR",
        message_id: resultado.ok ? resultado.messageId : null,
        error: resultado.ok ? null : resultado.error,
        enviado_por: perfil.userId,
        enviado_en: resultado.ok ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    await supabase
      .from("prefactura")
      .update({ estado: resultado.ok ? "ENVIADA" : "ERROR_ENVIO" })
      .eq("id", prefacturaId);

    if (envio) {
      const guias = await obtenerGuiasPrefactura(supabase, prefacturaId);
      await registrarLogEjecucion(
        supabase,
        envio.id,
        "CORREO",
        guias.map((guia) => ({
          guia,
          estado: resultado.ok ? "OK" : "ERROR",
          detalle: resultado.ok ? { prefacturaId } : { prefacturaId, error: resultado.error },
        })),
      );
    }

    revalidatePath(`/prefacturas/${prefacturaId}`);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    return { ok: true };
  } catch (error) {
    console.error("Error enviando correo de prefactura", prefacturaId, error);
    const mensaje = error instanceof Error ? error.message : "Error desconocido enviando el correo.";
    return { ok: false, error: mensaje };
  }
}

export interface ResultadoEncolar extends ResultadoAccion {
  loteId?: string;
  encoladas?: number;
  omitidas?: number;
  /** Cuántas de las omitidas se consolidaron en el ZIP de respaldo (ver EMAIL_FALLBACK_RECIPIENT). */
  consolidadasSinCorreo?: number;
}

interface PrefacturaSinCorreo {
  prefacturaId: string;
  storageKey: string;
  nombreArchivo: string;
  etiqueta: string;
}

/**
 * "Enviar seleccionados": crea un lote_proceso y encola 1 envio_correo por
 * prefactura con PDF vigente y correo registrado. Las que tienen PDF pero
 * NINGÚN correo registrado (ni en el vehículo ni en el transportista) no se
 * omiten: se agrupan y se encolan como UN solo envío consolidado (ZIP) a
 * EMAIL_FALLBACK_RECIPIENT — evita tanto perder esas prefacturas en silencio
 * como bombardear esa cuenta de respaldo con un correo por cada una.
 */
export async function encolarEnviosAction(prefacturaIds: string[]): Promise<ResultadoEncolar> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  if (prefacturaIds.length === 0) return { ok: false, error: "No hay prefacturas seleccionadas." };

  const supabase = await createClient();
  const { data: lote, error: errorLote } = await supabase
    .from("lote_proceso")
    .insert({ tipo: "CORREO", total: prefacturaIds.length, iniciado_por: perfil.userId })
    .select("id")
    .single();
  if (errorLote || !lote) return { ok: false, error: "No se pudo crear el lote." };

  let encoladas = 0;
  let omitidas = 0;
  const sinCorreo: PrefacturaSinCorreo[] = [];

  for (const prefacturaId of prefacturaIds) {
    const prefactura = await obtenerPrefactura(prefacturaId);
    if (!prefactura) {
      omitidas++;
      continue;
    }

    const { data: doc } = await supabase
      .from("documento_pdf")
      .select("id, storage_key, nombre_archivo")
      .eq("prefactura_id", prefacturaId)
      .eq("estado", "VIGENTE")
      .maybeSingle();
    if (!doc) {
      omitidas++;
      continue;
    }

    const contactos = await obtenerContactosPrefactura(
      prefactura.vehiculo?.id ?? null,
      prefactura.transportista?.id ?? null,
    );

    if (!contactos.principal) {
      sinCorreo.push({
        prefacturaId,
        storageKey: doc.storage_key,
        nombreArchivo: doc.nombre_archivo,
        etiqueta: `${prefactura.vehiculo?.placa ?? "(sin placa)"} - ${prefactura.numero ?? "(sin número)"}`,
      });
      continue;
    }

    const variables = construirVariablesPlantilla(prefactura);
    await supabase.from("envio_correo").insert({
      prefactura_id: prefacturaId,
      documento_pdf_id: doc.id,
      lote_id: lote.id,
      destinatarios_to: [contactos.principal],
      destinatarios_cc: contactos.adicionales,
      asunto: interpolarPlantilla(defaultAppConfig.correo.plantillaMasiva.asunto, variables),
      cuerpo: interpolarPlantilla(defaultAppConfig.correo.plantillaMasiva.cuerpo, variables),
      estado: "PENDIENTE",
    });
    await supabase.from("prefactura").update({ estado: "EN_COLA_ENVIO" }).eq("id", prefacturaId);
    encoladas++;
  }

  const consolidadasSinCorreo = await encolarConsolidadoSinCorreo(supabase, lote.id, sinCorreo);
  omitidas += sinCorreo.length - consolidadasSinCorreo;

  await supabase
    .from("lote_proceso")
    .update({ total: encoladas + (consolidadasSinCorreo > 0 ? 1 : 0) })
    .eq("id", lote.id);

  revalidatePath("/prefacturas");
  return { ok: true, loteId: lote.id, encoladas, omitidas, consolidadasSinCorreo };
}

/**
 * Descarga los PDF de `sinCorreo`, los empaqueta en un ZIP y encola un único
 * envio_correo consolidado a EMAIL_FALLBACK_RECIPIENT. Devuelve cuántas
 * prefacturas quedaron efectivamente cubiertas (0 si la variable no está
 * configurada, no hay nada que enviar, o falla la subida del ZIP — en esos
 * casos el llamador las cuenta como omitidas, igual que antes de este
 * mecanismo).
 */
async function encolarConsolidadoSinCorreo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loteId: string,
  sinCorreo: PrefacturaSinCorreo[],
): Promise<number> {
  if (sinCorreo.length === 0) return 0;

  const destinatarioRespaldo = process.env.EMAIL_FALLBACK_RECIPIENT?.trim();
  if (!destinatarioRespaldo) return 0;

  // Solo cuentan (y se listan) las que realmente se pudieron descargar y
  // meter al ZIP — si alguna falla, queda como omitida en vez de aparentar
  // que se envió sin estarlo realmente adjunta.
  const cubiertas: PrefacturaSinCorreo[] = [];
  const archivos: { nombreArchivo: string; contenido: Buffer }[] = [];
  for (const item of sinCorreo) {
    const { data: blob } = await supabase.storage.from("prefacturas").download(item.storageKey);
    if (blob) {
      archivos.push({ nombreArchivo: item.nombreArchivo, contenido: Buffer.from(await blob.arrayBuffer()) });
      cubiertas.push(item);
    }
  }
  if (archivos.length === 0) return 0;

  const zipBuffer = await crearZipPrefacturas(archivos);
  const zipStorageKey = `zips/sin-correo/${loteId}.zip`;
  const { error: errorSubida } = await supabase.storage
    .from("prefacturas")
    .upload(zipStorageKey, zipBuffer, { contentType: "application/zip", upsert: true });
  if (errorSubida) return 0;

  const listado = cubiertas.map((s) => `- ${s.etiqueta}`).join("\n");
  const { error: errorEnvio } = await supabase.from("envio_correo").insert({
    lote_id: loteId,
    destinatarios_to: [destinatarioRespaldo],
    destinatarios_cc: [],
    asunto: `Prefacturas sin correo registrado (${cubiertas.length})`,
    cuerpo:
      `Estas ${cubiertas.length} prefacturas no tienen correo registrado (ni en el vehículo ni en el ` +
      `transportista), así que se agrupan en el ZIP adjunto para revisión y envío manual:\n\n${listado}\n\n` +
      "Registra un correo en Vehículos o Transportistas para que la próxima vez se envíen directo a su destinatario.",
    estado: "PENDIENTE",
    zip_storage_key: zipStorageKey,
    zip_nombre_archivo: `prefacturas-sin-correo-${loteId}.zip`,
    prefactura_ids: cubiertas.map((s) => s.prefacturaId),
  });
  if (errorEnvio) return 0;

  for (const item of cubiertas) {
    await supabase.from("prefactura").update({ estado: "EN_COLA_ENVIO" }).eq("id", item.prefacturaId);
  }
  return cubiertas.length;
}

export interface ResultadoReintento extends ResultadoAccion {
  reintentadas?: number;
}

/**
 * "Reintentar fallidos": vuelve a PENDIENTE los envíos en ERROR de un lote
 * para que el worker los retome en su próximo ciclo (hasta 1 minuto, pg_cron
 * — este botón no envía nada al instante). No borra `error`: así el mensaje
 * del último intento sigue visible mientras el envío espera su turno, en vez
 * de desaparecer sin dejar rastro de qué había fallado.
 */
export async function reintentarFallidosLoteAction(loteId: string): Promise<ResultadoReintento> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: lote } = await supabase
    .from("lote_proceso")
    .select("fallidos")
    .eq("id", loteId)
    .maybeSingle();

  const { error, count } = await supabase
    .from("envio_correo")
    .update({ estado: "PENDIENTE", intentos: 0, proximo_intento: null }, { count: "exact" })
    .eq("lote_id", loteId)
    .eq("estado", "ERROR");
  if (error) return { ok: false, error: "No se pudo reintentar los envíos fallidos." };

  const reintentadas = count ?? 0;
  // El contador "fallidos" del lote es acumulado, nunca se decrementa solo:
  // sin este ajuste, los envíos que ya se devolvieron a PENDIENTE seguirían
  // contando como error en el resumen de arriba hasta que el worker los
  // vuelva a intentar (hasta 1 minuto después), dando la impresión de que
  // el botón no hizo nada.
  await supabase
    .from("lote_proceso")
    .update({ estado: "PROCESANDO", fallidos: Math.max(0, (lote?.fallidos ?? reintentadas) - reintentadas) })
    .eq("id", loteId);

  revalidatePath(`/prefacturas/lotes/${loteId}`);
  return { ok: true, reintentadas };
}
