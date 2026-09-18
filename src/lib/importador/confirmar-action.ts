"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

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
  return { ok: true, odtInsertadas: resumen?.odt_insertadas, novedadesGeneradas: resumen?.novedades_generadas };
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

/** Permite corregir la decisión de una fila puntual antes de confirmar. */
export async function establecerDecisionFilaAction(
  filaId: string,
  decision: "INSERTAR" | "OMITIR" | "CORREGIR",
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { error } = await supabase.from("importacion_fila").update({ decision }).eq("id", filaId);
  if (error) return { ok: false, error: "No se pudo actualizar la decisión." };
  return { ok: true };
}
