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
}

/** "Enviar seleccionados": crea un lote_proceso y encola 1 envio_correo por prefactura con PDF vigente y correo. */
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

  for (const prefacturaId of prefacturaIds) {
    const prefactura = await obtenerPrefactura(prefacturaId);
    if (!prefactura) {
      omitidas++;
      continue;
    }

    const { data: doc } = await supabase
      .from("documento_pdf")
      .select("id")
      .eq("prefactura_id", prefacturaId)
      .eq("estado", "VIGENTE")
      .maybeSingle();
    const contactos = await obtenerContactosPrefactura(
      prefactura.vehiculo?.id ?? null,
      prefactura.transportista?.id ?? null,
    );

    if (!doc || !contactos.principal) {
      omitidas++;
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

  await supabase.from("lote_proceso").update({ total: encoladas, fallidos: omitidas }).eq("id", lote.id);

  revalidatePath("/prefacturas");
  return { ok: true, loteId: lote.id, encoladas, omitidas };
}

/** "Reintentar fallidos": vuelve a PENDIENTE los envíos en ERROR de un lote para que el worker los retome. */
export async function reintentarFallidosLoteAction(loteId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("envio_correo")
    .update({ estado: "PENDIENTE", intentos: 0, proximo_intento: null, error: null }, { count: "exact" })
    .eq("lote_id", loteId)
    .eq("estado", "ERROR");
  if (error) return { ok: false, error: "No se pudo reintentar los envíos fallidos." };

  await supabase.from("lote_proceso").update({ estado: "PROCESANDO" }).eq("id", loteId);

  revalidatePath(`/prefacturas/lotes/${loteId}`);
  return { ok: true, id: String(count ?? 0) };
}
