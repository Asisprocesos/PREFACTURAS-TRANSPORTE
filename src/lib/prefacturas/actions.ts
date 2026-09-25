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
