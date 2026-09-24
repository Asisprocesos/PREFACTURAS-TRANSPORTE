import "server-only";

import { createHash } from "node:crypto";

import { registrarLogEjecucion } from "@/lib/log-ejecucion/registrar";
import { createClient } from "@/lib/supabase/server";
import { completarRuc } from "@/lib/transportistas/display";

import { generarBufferPdf, nombreArchivoPdf, validarPrefacturaParaPdf } from "./generar";

export interface ResultadoGeneracionPdf {
  ok: boolean;
  error?: string;
  documentoId?: string;
  storageKey?: string;
  buffer?: Buffer;
  nombreArchivo?: string;
}

/**
 * Genera (o regenera con nueva versión) el PDF de una prefactura y lo deja
 * persistido en Storage + `documento_pdf`. Compartido por el Route Handler
 * `/api/prefacturas/:id/pdf` y por el envío de correo (que genera el PDF
 * al vuelo si todavía no existe uno vigente), para no duplicar la lógica
 * de validación/versionado en dos lugares.
 */
export async function generarYGuardarPdf(
  prefacturaId: string,
  generadoPor: string,
): Promise<ResultadoGeneracionPdf> {
  const validacion = await validarPrefacturaParaPdf(prefacturaId);
  if (!validacion.ok) return { ok: false, error: validacion.motivo };
  const { prefactura } = validacion;

  const supabase = await createClient();
  const { count: novedadesError } = await supabase
    .from("novedad")
    .select("id", { count: "exact", head: true })
    .eq("placa", prefactura.vehiculo?.placa ?? "")
    .eq("periodo_id", prefactura.periodo_id)
    .eq("severidad", "ERROR")
    .eq("estado", "ABIERTA");
  if ((novedadesError ?? 0) > 0) {
    return { ok: false, error: "La placa tiene novedades de severidad ERROR abiertas." };
  }

  const { buffer, detalleOdt } = await generarBufferPdf(prefactura);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const version = prefactura.version_actual + 1;

  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const ruc = prefactura.transportista!.ruc;
  // La ruta de Storage usa el RUC tal cual está guardado (clave interna, no
  // visible): completarlo aquí mezclaría carpetas de 12 y 13 dígitos para
  // un mismo transportista según cuándo se generó cada versión.
  const storageKey = `prefacturas/${anio}/${mes}/${ruc}/${prefactura.numero}_v${version}.pdf`;
  const nombreArchivo = nombreArchivoPdf(prefactura.vehiculo?.placa ?? "", completarRuc(ruc));

  // La subida a Storage y marcar la versión anterior como REEMPLAZADO son
  // independientes entre sí: se corren en paralelo para no sumar otra
  // ida y vuelta secuencial al tiempo total de la función.
  const [{ error: errorSubida }] = await Promise.all([
    supabase.storage.from("prefacturas").upload(storageKey, buffer, {
      contentType: "application/pdf",
      upsert: true,
    }),
    supabase
      .from("documento_pdf")
      .update({ estado: "REEMPLAZADO" })
      .eq("prefactura_id", prefacturaId)
      .eq("estado", "VIGENTE"),
  ]);
  if (errorSubida) return { ok: false, error: `No se pudo guardar el PDF: ${errorSubida.message}` };

  const { data: documento, error: errorDoc } = await supabase
    .from("documento_pdf")
    .insert({
      prefactura_id: prefacturaId,
      nombre_archivo: nombreArchivo,
      storage_key: storageKey,
      version,
      tamano_bytes: buffer.length,
      checksum,
      generado_por: generadoPor,
      estado: "VIGENTE",
    })
    .select("id")
    .single();
  if (errorDoc || !documento) return { ok: false, error: "No se pudo registrar el documento generado." };

  await Promise.all([
    supabase
      .from("prefactura")
      .update({ estado: "PDF_GENERADO", version_actual: version })
      .eq("id", prefacturaId),
    registrarLogEjecucion(
      supabase,
      documento.id,
      "PDF",
      detalleOdt.map((o) => ({ guia: o.guia, estado: "OK", detalle: { prefacturaId, version } })),
    ),
  ]);

  return { ok: true, documentoId: documento.id, storageKey, buffer, nombreArchivo };
}
