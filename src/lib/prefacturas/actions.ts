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
