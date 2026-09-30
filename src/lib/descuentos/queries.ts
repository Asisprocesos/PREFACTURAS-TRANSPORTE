import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Descuento = Database["public"]["Tables"]["descuento"]["Row"];

/** Descuentos activos (no anulados) de una ODT, más recientes primero. */
export async function listarDescuentosOdt(odtId: string): Promise<Descuento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("descuento")
    .select("*")
    .eq("odt_id", odtId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Suma de descuentos activos por odt_id, para varias ODT a la vez (ej. detalle de prefactura). */
export async function obtenerDescuentosPorOdt(
  odtIds: string[],
): Promise<Map<string, { total: number; motivos: string[] }>> {
  const mapa = new Map<string, { total: number; motivos: string[] }>();
  if (odtIds.length === 0) return mapa;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("descuento")
    .select("odt_id, concepto, valor")
    .in("odt_id", odtIds)
    .is("deleted_at", null);
  if (error) throw error;

  for (const d of data ?? []) {
    if (!d.odt_id) continue;
    const actual = mapa.get(d.odt_id) ?? { total: 0, motivos: [] };
    actual.total += d.valor;
    if (d.concepto) actual.motivos.push(d.concepto);
    mapa.set(d.odt_id, actual);
  }
  return mapa;
}
