"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { marcarRequiereRegenerar } from "@/lib/odt/actions";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

/**
 * Recalcula total_descuentos y total de cada prefactura (principal o
 * secundaria) que incluye esta ODT, a partir de los descuentos activos de
 * TODAS las ODT congeladas en su prefactura_detalle. total_odt no cambia acá
 * (eso lo maneja "Generar prefacturas del período"), solo el neto.
 */
async function recalcularPrefacturasDeOdt(odtId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: detalle } = await supabase
    .from("prefactura_detalle")
    .select("prefactura_id")
    .eq("odt_id", odtId);
  const prefacturaIds = [...new Set((detalle ?? []).map((d) => d.prefactura_id))];

  for (const prefacturaId of prefacturaIds) {
    const { data: todoElDetalle } = await supabase
      .from("prefactura_detalle")
      .select("odt_id")
      .eq("prefactura_id", prefacturaId);
    const odtIds = (todoElDetalle ?? []).map((d) => d.odt_id);

    const { data: descuentos } = await supabase
      .from("descuento")
      .select("valor")
      .in("odt_id", odtIds)
      .is("deleted_at", null);
    const totalDescuentos = (descuentos ?? []).reduce((acc, d) => acc + d.valor, 0);

    const { data: prefactura } = await supabase
      .from("prefactura")
      .select("total_odt")
      .eq("id", prefacturaId)
      .single();
    if (!prefactura) continue;

    await supabase
      .from("prefactura")
      .update({ total_descuentos: totalDescuentos, total: prefactura.total_odt - totalDescuentos })
      .eq("id", prefacturaId);
  }

  return prefacturaIds;
}

async function revalidarPrefacturas(odtId: string) {
  const marcadas = await marcarRequiereRegenerar(odtId);
  const afectadas = await recalcularPrefacturasDeOdt(odtId);
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
