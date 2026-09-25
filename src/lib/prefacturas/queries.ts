import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, EstadoPrefactura } from "@/types/database.types";

export type Prefactura = Database["public"]["Tables"]["prefactura"]["Row"];
export type Odt = Database["public"]["Tables"]["odt"]["Row"];
export type Novedad = Database["public"]["Tables"]["novedad"]["Row"];

export interface PrefacturaConRelaciones extends Prefactura {
  vehiculo: { id: string; placa: string } | null;
  transportista: { id: string; razon_social: string; nombre: string | null; ruc: string } | null;
  periodo: { id: string; nombre: string } | null;
}

export interface ListarPrefacturasParams {
  pagina: number;
  tamanoPagina: number;
  periodoId?: string;
  estado?: EstadoPrefactura;
  busqueda?: string;
}

export async function listarPrefacturas({
  pagina,
  tamanoPagina,
  periodoId,
  estado,
  busqueda,
}: ListarPrefacturasParams): Promise<{ filas: PrefacturaConRelaciones[]; total: number }> {
  const supabase = await createClient();
  const desde = (pagina - 1) * tamanoPagina;
  const hasta = desde + tamanoPagina - 1;

  let query = supabase
    .from("prefactura")
    .select(
      "*, vehiculo:vehiculo_id(id, placa), transportista:transportista_id(id, razon_social, nombre, ruc), periodo:periodo_id(id, nombre)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(desde, hasta);

  if (periodoId) query = query.eq("periodo_id", periodoId);
  if (estado) query = query.eq("estado", estado);

  const termino = busqueda?.trim();
  if (termino) {
    // `numero` vive en prefactura, pero placa/transportista viven en las
    // tablas relacionadas — PostgREST no permite un OR que cruce la tabla
    // base con columnas de tablas embebidas en una sola condición, así que
    // se resuelven los ids que hacen match aparte y se filtra prefactura
    // por vehiculo_id/transportista_id (mismo patrón que listarDocumentos
    // en repositorio/queries.ts). El límite de 200 es solo defensa: evita
    // un IN gigantesco si el término coincidiera con medio maestro entero.
    const [{ data: vehiculosMatch }, { data: transportistasMatch }] = await Promise.all([
      supabase.from("vehiculo").select("id").ilike("placa", `%${termino}%`).limit(200),
      supabase
        .from("transportista")
        .select("id")
        .or(`razon_social.ilike.%${termino}%,nombre.ilike.%${termino}%`)
        .limit(200),
    ]);
    const vehiculoIds = (vehiculosMatch ?? []).map((v) => v.id);
    const transportistaIds = (transportistasMatch ?? []).map((t) => t.id);

    const condiciones = [`numero.ilike.%${termino}%`];
    if (vehiculoIds.length > 0) condiciones.push(`vehiculo_id.in.(${vehiculoIds.join(",")})`);
    if (transportistaIds.length > 0) condiciones.push(`transportista_id.in.(${transportistaIds.join(",")})`);
    query = query.or(condiciones.join(","));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { filas: (data ?? []) as unknown as PrefacturaConRelaciones[], total: count ?? 0 };
}

/**
 * Prefacturas del período que todavía no tienen PDF (BORRADOR) o cuyo PDF
 * vigente quedó desactualizado por una corrección de ODT posterior
 * (REQUIERE_REGENERAR, ver marcarRequiereRegenerar en odt/actions.ts). Las
 * demás ya tienen un PDF vigente y sin cambios desde entonces, así que
 * "Generar todos" las deja intactas para no generar duplicados de más.
 */
export async function listarPrefacturasParaGenerarPdf(
  periodoId: string,
): Promise<{ id: string; numero: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prefactura")
    .select("id, numero")
    .eq("periodo_id", periodoId)
    .in("estado", ["BORRADOR", "REQUIERE_REGENERAR"])
    .order("numero", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerPrefactura(id: string): Promise<PrefacturaConRelaciones | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prefactura")
    .select(
      "*, vehiculo:vehiculo_id(id, placa), transportista:transportista_id(id, razon_social, nombre, ruc), periodo:periodo_id(id, nombre)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as PrefacturaConRelaciones | null;
}

export interface FilaResumenFacturacion {
  centro_costo_final: string | null;
  regional: string | null;
  ruta_macro: string | null;
  cantidad: number | null;
  suma: number | null;
  valor_unitario_promedio: number | null;
}

export async function obtenerResumenFacturacion(prefacturaId: string): Promise<FilaResumenFacturacion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_resumen_facturacion")
    .select("*")
    .eq("prefactura_id", prefacturaId);
  if (error) throw error;
  return data ?? [];
}

export async function obtenerDetalleOdt(prefacturaId: string): Promise<Odt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prefactura_detalle")
    .select("odt:odt_id(*)")
    .eq("prefactura_id", prefacturaId);
  if (error) throw error;
  return ((data ?? []) as unknown as { odt: Odt }[])
    .map((f) => f.odt)
    .sort((a, b) => a.fecha_creacion.localeCompare(b.fecha_creacion));
}

export async function obtenerNovedadesPrefactura(
  placa: string | null,
  periodoId: string | null,
): Promise<Novedad[]> {
  if (!placa || !periodoId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("novedad")
    .select("*")
    .eq("placa", placa)
    .eq("periodo_id", periodoId)
    .order("severidad", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
