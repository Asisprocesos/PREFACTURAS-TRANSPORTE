"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { listarPrefacturasParaGenerarPdf } from "./queries";

export interface ResultadoGeneracion extends ResultadoAccion {
  creadas?: number;
  actualizadas?: number;
}

/** Para el botón "Generar todos los PDF del período" (ver generar-todos-pdf-button.tsx). */
export async function listarPrefacturasParaGenerarPdfAction(
  periodoId: string,
): Promise<{ id: string; numero: string | null }[]> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  return listarPrefacturasParaGenerarPdf(periodoId);
}

export async function generarPrefacturasPeriodoAction(periodoId: string): Promise<ResultadoGeneracion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("generar_prefacturas_periodo", { p_periodo_id: periodoId });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/prefacturas");
  revalidatePath("/control-placa");
  const resumen = data?.[0];
  return { ok: true, creadas: resumen?.prefacturas_creadas, actualizadas: resumen?.prefacturas_actualizadas };
}

/**
 * Anular deja la prefactura fuera de circulación sin borrarla: el estado
 * ANULADA bloquea el envío por correo (ver enviarCorreoIndividualAction y
 * encolarEnviosAction en correo/actions.ts) hasta que se reactive o se
 * elimine. No toca el PDF ya generado ni el estado de las ODT asociadas.
 */
export async function anularPrefacturaAction(prefacturaId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { error } = await supabase.from("prefactura").update({ estado: "ANULADA" }).eq("id", prefacturaId);
  if (error) return { ok: false, error: "No se pudo anular la prefactura." };

  revalidatePath("/prefacturas");
  revalidatePath(`/prefacturas/${prefacturaId}`);
  revalidatePath("/control-placa");
  return { ok: true };
}

export interface ResultadoAnularVarias extends ResultadoAccion {
  anuladas?: number;
}

/** Para "Anular seleccionadas" en la tabla de prefacturas (ver prefacturas-table.tsx). */
export async function anularPrefacturasAction(prefacturaIds: string[]): Promise<ResultadoAnularVarias> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  if (prefacturaIds.length === 0) return { ok: false, error: "No hay prefacturas seleccionadas." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("prefactura")
    .update({ estado: "ANULADA" }, { count: "exact" })
    .in("id", prefacturaIds);
  if (error) return { ok: false, error: "No se pudieron anular las prefacturas." };

  revalidatePath("/prefacturas");
  revalidatePath("/control-placa");
  return { ok: true, anuladas: count ?? prefacturaIds.length };
}

/**
 * Reactivar vuelve la prefactura a BORRADOR: no hay estado previo guardado
 * (una prefactura puede haberse anulado desde cualquier estado), así que se
 * reinicia al estado neutral de partida. El PDF vigente, si existe, no se
 * borra ni se fuerza a regenerar — sigue disponible para enviar o descargar.
 */
export async function reactivarPrefacturaAction(prefacturaId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("prefactura")
    .select("estado")
    .eq("id", prefacturaId)
    .maybeSingle();
  if (actual?.estado !== "ANULADA") return { ok: false, error: "La prefactura no está anulada." };

  const { error } = await supabase.from("prefactura").update({ estado: "BORRADOR" }).eq("id", prefacturaId);
  if (error) return { ok: false, error: "No se pudo reactivar la prefactura." };

  revalidatePath("/prefacturas");
  revalidatePath(`/prefacturas/${prefacturaId}`);
  revalidatePath("/control-placa");
  return { ok: true };
}

/** Para el panel de confirmación de "Eliminar prefacturas del período" (ver eliminar-prefacturas-periodo-button.tsx). */
export async function contarPrefacturasPeriodoAction(periodoId: string): Promise<number> {
  await requireRole(["ADMIN"]);
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("prefactura")
    .select("*", { count: "exact", head: true })
    .eq("periodo_id", periodoId);
  if (error) throw error;
  return count ?? 0;
}

export interface ResultadoEliminarPrefacturasPeriodo extends ResultadoAccion {
  eliminadas?: number;
}

/**
 * Borrado físico (no anulación) de TODAS las prefacturas de un período —
 * pensado para limpiar datos de prueba antes de entregar el sistema, mismo
 * criterio que eliminarDocumentosPdfAction en repositorio/actions.ts. Solo
 * ADMIN, porque además borra archivos del bucket de Storage.
 *
 * prefactura_detalle, documento_pdf, descuento (vía prefactura_id legado) y
 * factura_transportista tienen ON DELETE CASCADE, así que desaparecen
 * solos. envio_correo.prefactura_id NO tiene cascade (a propósito, para
 * conservar el historial de envíos en el uso normal del día a día) — acá sí
 * se borra explícito, porque es historial de prefacturas que están a punto
 * de desaparecer. Los archivos PDF en Storage tampoco se borran solos al
 * borrar la fila de documento_pdf, así que se eliminan primero.
 *
 * Las ODT importadas, la importación y el período en sí NO se tocan: el
 * período queda listo para "Generar prefacturas del período" de nuevo si
 * hace falta. Cada fila borrada queda igual registrada en Historial de
 * cambios vía el trigger de auditoría genérico.
 */
export async function eliminarPrefacturasPeriodoAction(
  periodoId: string,
): Promise<ResultadoEliminarPrefacturasPeriodo> {
  await requireRole(["ADMIN"]);
  const supabase = await createClient();

  const { data: prefacturas, error: errorConsulta } = await supabase
    .from("prefactura")
    .select("id")
    .eq("periodo_id", periodoId);
  if (errorConsulta) return { ok: false, error: "No se pudieron consultar las prefacturas del período." };
  if (!prefacturas || prefacturas.length === 0) return { ok: true, eliminadas: 0 };

  const ids = prefacturas.map((p) => p.id);

  const { data: documentos, error: errorDocumentos } = await supabase
    .from("documento_pdf")
    .select("storage_key")
    .in("prefactura_id", ids);
  if (errorDocumentos) return { ok: false, error: "No se pudieron consultar los PDF del período." };
  if (documentos && documentos.length > 0) {
    const { error: errorStorage } = await supabase.storage
      .from("prefacturas")
      .remove(documentos.map((d) => d.storage_key));
    if (errorStorage) {
      return {
        ok: false,
        error: `No se pudieron eliminar los PDF del almacenamiento: ${errorStorage.message}`,
      };
    }
  }

  const { error: errorEnvios } = await supabase.from("envio_correo").delete().in("prefactura_id", ids);
  if (errorEnvios) return { ok: false, error: "No se pudo eliminar el historial de envíos del período." };

  const { error: errorBorrado, count } = await supabase
    .from("prefactura")
    .delete({ count: "exact" })
    .eq("periodo_id", periodoId);
  if (errorBorrado) return { ok: false, error: "No se pudieron eliminar las prefacturas del período." };

  revalidatePath("/prefacturas");
  revalidatePath("/control-placa");
  revalidatePath("/repositorio");
  revalidatePath("/dashboard");
  revalidatePath("/transportistas/seguimiento");
  return { ok: true, eliminadas: count ?? ids.length };
}
