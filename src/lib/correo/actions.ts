"use server";

import { revalidatePath } from "next/cache";

import { defaultAppConfig } from "@/config/app.config";
import { requireRole } from "@/lib/auth/roles";
import { obtenerAjustesCorreoPrueba, separarCorreos } from "@/lib/config/correo-prueba";
import { interpolarPlantilla } from "@/lib/email/plantilla";
import { obtenerGuiasPrefactura, registrarLogEjecucion } from "@/lib/log-ejecucion/registrar";
import { obtenerPrefactura, type PrefacturaConRelaciones } from "@/lib/prefacturas/queries";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";
import type { Database } from "@/types/database.types";
import { generarYGuardarPdf } from "@/pdf/generar-y-guardar";

import { construirVariablesPlantilla } from "./plantilla-variables";
import {
  obtenerContactosPrefactura,
  obtenerLoteProceso,
  listarEnviosLote,
  type EnvioCorreo,
  type LoteProceso,
} from "./queries";
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
    if (prefactura.estado === "ANULADA") {
      return { ok: false, error: "La prefactura está anulada. Reactívala antes de enviarla por correo." };
    }

    const pdf = await obtenerPdfVigenteOGenerar(prefacturaId, perfil.userId);
    if (!pdf.ok) return { ok: false, error: pdf.error };

    // obtenerEmailProvider() lanza si faltan las variables SMTP_* o el
    // destinatario de prueba — sin este try/catch esa excepción se
    // propagaba sin capturar hasta el cliente, y el botón "Enviar" se
    // quedaba en "Enviando..." para siempre porque nunca llegaba a limpiar
    // su estado.
    const { obtenerEmailProvider } = await import("@/lib/email/provider");
    const proveedor = await obtenerEmailProvider();
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
  /** Cuántas de las omitidas se consolidaron en el ZIP de respaldo (ver obtenerAjustesCorreoPrueba). */
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
 * omiten: se agrupan y se encolan como UN solo envío consolidado (ZIP) al
 * destinatario de respaldo (ver obtenerAjustesCorreoPrueba) — evita tanto
 * perder esas prefacturas en silencio como bombardear esa cuenta con un
 * correo por cada una.
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
    if (!prefactura || prefactura.estado === "ANULADA") {
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

const TAMANO_LOTE_CONSULTA = 500;

function enLotes<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}

/**
 * Trae en lotes de TAMANO_LOTE_CONSULTA en vez de un solo `.in(...)` con
 * todos los ids — con un período grande (cientos o miles de prefacturas),
 * meterlos todos en una sola consulta genera una URL enorme (PostgREST
 * codifica el filtro ahí): el mismo problema de fondo que se corrigió en
 * validar-action.ts para la importación de archivos grandes.
 */
async function enLotesConsulta<T>(ids: string[], consultar: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const resultados: T[] = [];
  for (const lote of enLotes(ids, TAMANO_LOTE_CONSULTA)) {
    resultados.push(...(await consultar(lote)));
  }
  return resultados;
}

/**
 * "Enviar todos los del período": igual que encolarEnviosAction pero sin
 * tener que seleccionar fila por fila (ni página por página, ya que el
 * checkbox "seleccionar todos" de la tabla solo marca la página visible).
 * A diferencia de esa, acá SÍ hace falta que las consultas estén por lotes
 * desde el principio — un período puede tener cientos de prefacturas, y
 * encolarEnviosAction hace ~5 consultas POR prefactura (pensada para una
 * selección manual de unas pocas), lo que para un período completo se
 * arriesga a tardar minutos o superar el límite de la función serverless.
 */
export async function encolarTodosDelPeriodoAction(periodoId: string): Promise<ResultadoEncolar> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: prefacturasData, error: errorPrefacturas } = await supabase
    .from("prefactura")
    .select(
      "*, vehiculo:vehiculo_id(id, placa), transportista:transportista_id(id, razon_social, nombre, ruc), periodo:periodo_id(id, nombre)",
    )
    .eq("periodo_id", periodoId)
    .in("estado", ["PDF_GENERADO", "ERROR_ENVIO"]);
  if (errorPrefacturas) return { ok: false, error: "No se pudieron consultar las prefacturas del período." };
  const prefacturas = (prefacturasData ?? []) as unknown as PrefacturaConRelaciones[];
  if (prefacturas.length === 0) {
    return { ok: false, error: "No hay prefacturas con PDF listas para enviar en este período." };
  }

  const ids = prefacturas.map((p) => p.id);
  const { data: lote, error: errorLote } = await supabase
    .from("lote_proceso")
    .insert({
      tipo: "CORREO",
      total: prefacturas.length,
      iniciado_por: perfil.userId,
      periodo_id: periodoId,
      detalle: `Envío masivo (todas del período)${prefacturas[0]?.periodo?.nombre ? ` · ${prefacturas[0].periodo.nombre}` : ""}`,
    })
    .select("id")
    .single();
  if (errorLote || !lote) return { ok: false, error: "No se pudo crear el lote." };

  const documentos = await enLotesConsulta(ids, async (loteIds) => {
    const { data } = await supabase
      .from("documento_pdf")
      .select("prefactura_id, id, storage_key, nombre_archivo")
      .in("prefactura_id", loteIds)
      .eq("estado", "VIGENTE");
    return data ?? [];
  });
  const documentoPorPrefactura = new Map(documentos.map((d) => [d.prefactura_id, d]));

  const vehiculoIds = [...new Set(prefacturas.map((p) => p.vehiculo?.id).filter((x): x is string => !!x))];
  const transportistaIds = [
    ...new Set(prefacturas.map((p) => p.transportista?.id).filter((x): x is string => !!x)),
  ];

  const [contactosVehiculo, contactosTransportista] = await Promise.all([
    enLotesConsulta(vehiculoIds, async (loteIds) => {
      const { data } = await supabase
        .from("contacto_correo")
        .select("email, tipo, vehiculo_id, transportista_id")
        .in("vehiculo_id", loteIds)
        .eq("activo", true);
      return data ?? [];
    }),
    enLotesConsulta(transportistaIds, async (loteIds) => {
      const { data } = await supabase
        .from("contacto_correo")
        .select("email, tipo, vehiculo_id, transportista_id")
        .in("transportista_id", loteIds)
        .eq("activo", true);
      return data ?? [];
    }),
  ]);

  const contactosPorVehiculo = new Map<string, typeof contactosVehiculo>();
  for (const c of contactosVehiculo) {
    if (!c.vehiculo_id) continue;
    contactosPorVehiculo.set(c.vehiculo_id, [...(contactosPorVehiculo.get(c.vehiculo_id) ?? []), c]);
  }
  const contactosPorTransportista = new Map<string, typeof contactosTransportista>();
  for (const c of contactosTransportista) {
    if (!c.transportista_id) continue;
    contactosPorTransportista.set(c.transportista_id, [
      ...(contactosPorTransportista.get(c.transportista_id) ?? []),
      c,
    ]);
  }

  type FilaEnvio = Database["public"]["Tables"]["envio_correo"]["Insert"];
  const filasEnvio: FilaEnvio[] = [];
  const idsEncolados: string[] = [];
  const sinCorreo: PrefacturaSinCorreo[] = [];
  let omitidasSinPdf = 0;

  for (const prefactura of prefacturas) {
    const doc = documentoPorPrefactura.get(prefactura.id);
    if (!doc) {
      omitidasSinPdf++;
      continue;
    }

    const pool = [
      ...(prefactura.vehiculo ? (contactosPorVehiculo.get(prefactura.vehiculo.id) ?? []) : []),
      ...(prefactura.transportista ? (contactosPorTransportista.get(prefactura.transportista.id) ?? []) : []),
    ];
    const principal = pool.find((c) => c.tipo === "PRINCIPAL")?.email ?? null;
    const adicionales = pool.filter((c) => c.email !== principal).map((c) => c.email);

    if (!principal) {
      sinCorreo.push({
        prefacturaId: prefactura.id,
        storageKey: doc.storage_key,
        nombreArchivo: doc.nombre_archivo,
        etiqueta: `${prefactura.vehiculo?.placa ?? "(sin placa)"} - ${prefactura.numero ?? "(sin número)"}`,
      });
      continue;
    }

    const variables = construirVariablesPlantilla(prefactura);
    filasEnvio.push({
      prefactura_id: prefactura.id,
      documento_pdf_id: doc.id,
      lote_id: lote.id,
      destinatarios_to: [principal],
      destinatarios_cc: adicionales,
      asunto: interpolarPlantilla(defaultAppConfig.correo.plantillaMasiva.asunto, variables),
      cuerpo: interpolarPlantilla(defaultAppConfig.correo.plantillaMasiva.cuerpo, variables),
      estado: "PENDIENTE",
    });
    idsEncolados.push(prefactura.id);
  }

  for (const loteFilas of enLotes(filasEnvio, TAMANO_LOTE_CONSULTA)) {
    const { error } = await supabase.from("envio_correo").insert(loteFilas);
    if (error) return { ok: false, error: `No se pudo encolar: ${error.message}` };
  }
  for (const loteIds of enLotes(idsEncolados, TAMANO_LOTE_CONSULTA)) {
    await supabase.from("prefactura").update({ estado: "EN_COLA_ENVIO" }).in("id", loteIds);
  }

  const consolidadasSinCorreo = await encolarConsolidadoSinCorreo(supabase, lote.id, sinCorreo);
  const encoladas = idsEncolados.length;
  const omitidas = omitidasSinPdf + (sinCorreo.length - consolidadasSinCorreo);

  await supabase
    .from("lote_proceso")
    .update({ total: encoladas + (consolidadasSinCorreo > 0 ? 1 : 0) })
    .eq("id", lote.id);

  revalidatePath("/prefacturas");
  return { ok: true, loteId: lote.id, encoladas, omitidas, consolidadasSinCorreo };
}

/**
 * Descarga los PDF de `sinCorreo`, los empaqueta en un ZIP y encola un único
 * envio_correo consolidado al destinatario de respaldo (configuración
 * "correo_prueba" o EMAIL_FALLBACK_RECIPIENT, ver obtenerAjustesCorreoPrueba).
 * Devuelve cuántas prefacturas quedaron efectivamente cubiertas (0 si no hay
 * destinatario configurado, no hay nada que enviar, o falla la subida del
 * ZIP — en esos casos el llamador las cuenta como omitidas, igual que antes
 * de este mecanismo).
 */
async function encolarConsolidadoSinCorreo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loteId: string,
  sinCorreo: PrefacturaSinCorreo[],
): Promise<number> {
  if (sinCorreo.length === 0) return 0;

  const { destinatarioFallback } = await obtenerAjustesCorreoPrueba();
  const destinatariosRespaldo = separarCorreos(destinatarioFallback);
  if (destinatariosRespaldo.length === 0) return 0;

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
    destinatarios_to: destinatariosRespaldo,
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

export interface EstadoLote {
  lote: LoteProceso;
  envios: EnvioCorreo[];
}

/**
 * Para el sondeo de la pantalla de progreso (ver progreso-lote.tsx): la
 * suscripción de Supabase Realtime es la vía rápida, pero no es 100%
 * confiable (depende del websocket del navegador y de que la publicación
 * esté bien configurada), así que esta acción sirve de respaldo para que
 * el estado mostrado nunca se quede pegado aunque Realtime no entregue
 * ningún evento.
 */
export async function obtenerEstadoLoteAction(loteId: string): Promise<EstadoLote | null> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const lote = await obtenerLoteProceso(loteId);
  if (!lote) return null;
  const envios = await listarEnviosLote(loteId);
  return { lote, envios };
}
