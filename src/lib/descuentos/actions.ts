"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { marcarRequiereRegenerar, recalcularTotalesPrefacturasDeOdt } from "@/lib/odt/actions";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

async function revalidarPrefacturas(odtId: string) {
  const marcadas = await marcarRequiereRegenerar(odtId);
  const afectadas = await recalcularTotalesPrefacturasDeOdt(odtId);
  const ids = new Set([...marcadas, ...afectadas]);
  revalidatePath("/control-placa");
  revalidatePath("/prefacturas");
  for (const id of ids) revalidatePath(`/prefacturas/${id}`);
}

export async function crearDescuentoAction(
  odtId: string,
  motivo: string,
  monto: number,
): Promise<ResultadoAccion> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  if (!motivo.trim()) return { ok: false, error: "El motivo del descuento es obligatorio." };
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: "El monto debe ser mayor a 0." };

  const supabase = await createClient();
  const { data: odt, error: errorLectura } = await supabase.from("odt").select("id").eq("id", odtId).single();
  if (errorLectura || !odt) return { ok: false, error: "ODT no encontrada." };

  const { error } = await supabase.from("descuento").insert({
    odt_id: odtId,
    concepto: motivo.trim(),
    valor: monto,
    fecha: new Date().toISOString().slice(0, 10),
    created_by: perfil.userId,
  });
  if (error) return { ok: false, error: "No se pudo registrar el descuento." };

  await revalidarPrefacturas(odtId);
  return { ok: true };
}

export async function actualizarDescuentoAction(
  descuentoId: string,
  motivo: string,
  monto: number,
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  if (!motivo.trim()) return { ok: false, error: "El motivo del descuento es obligatorio." };
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: "El monto debe ser mayor a 0." };

  const supabase = await createClient();
  const { data: descuento, error: errorLectura } = await supabase
    .from("descuento")
    .select("odt_id")
    .eq("id", descuentoId)
    .single();
  if (errorLectura || !descuento || !descuento.odt_id)
    return { ok: false, error: "Descuento no encontrado." };

  const { error } = await supabase
    .from("descuento")
    .update({ concepto: motivo.trim(), valor: monto })
    .eq("id", descuentoId);
  if (error) return { ok: false, error: "No se pudo corregir el descuento." };

  await revalidarPrefacturas(descuento.odt_id);
  return { ok: true };
}

export async function anularDescuentoAction(descuentoId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const supabase = await createClient();
  const { data: descuento, error: errorLectura } = await supabase
    .from("descuento")
    .select("odt_id")
    .eq("id", descuentoId)
    .single();
  if (errorLectura || !descuento || !descuento.odt_id)
    return { ok: false, error: "Descuento no encontrado." };

  const { error } = await supabase
    .from("descuento")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", descuentoId);
  if (error) return { ok: false, error: "No se pudo anular el descuento." };

  await revalidarPrefacturas(descuento.odt_id);
  return { ok: true };
}
