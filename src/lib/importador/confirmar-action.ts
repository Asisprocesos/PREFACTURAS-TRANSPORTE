"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { recalcularResumenImportacion } from "./resumen";
import type { ResumenValidacion } from "./validar-action";

export interface ResultadoConfirmacion extends ResultadoAccion {
  odtInsertadas?: number;
  novedadesGeneradas?: number;
}

export async function confirmarImportacionAction(importacionId: string): Promise<ResultadoConfirmacion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("confirmar_importacion", { p_importacion_id: importacionId });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/importar/${importacionId}`);
  revalidatePath("/importar");
  const resumen = data?.[0];
  return {
    ok: true,
    odtInsertadas: resumen?.odt_insertadas,
    novedadesGeneradas: resumen?.novedades_generadas,
  };
}

export async function revertirImportacionAction(importacionId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("revertir_importacion", { p_importacion_id: importacionId });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/importar/${importacionId}`);
  revalidatePath("/importar");
  return { ok: true };
}

/**
 * Permite decidir manualmente una fila puntual antes de confirmar (Omitir /
 * Insertar de todas formas). Se usa desde la pestaña de Advertencias, donde
 * la fila ya no tiene errores estructurales y forzar la decisión es seguro.
 * Para filas con errores reales, usar `corregirFilaImportacionAction`: solo
 * pasan a INSERTAR una vez que la revalidación confirma que ya no violan
 * ninguna regla (evita que un error como "guía duplicada" rompa la
 * confirmación completa del lote por violar la restricción única de `odt`).
 */
export async function establecerDecisionFilaAction(
  filaId: string,
  decision: "INSERTAR" | "OMITIR",
): Promise<ResultadoAccion & { resumen?: ResumenValidacion }> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: fila, error } = await supabase
    .from("importacion_fila")
    .update({ decision })
    .eq("id", filaId)
    .select("importacion_id")
    .single();
  if (error || !fila) return { ok: false, error: "No se pudo actualizar la decisión." };

  const resumen = await recalcularResumenImportacion(fila.importacion_id);
  return { ok: true, resumen };
}
