import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type OdtRow = Database["public"]["Tables"]["odt"]["Row"];

export interface OdtConRelaciones extends OdtRow {
  vehiculo: {
    id: string;
    placa: string;
    transportista: { id: string; razon_social: string } | null;
  } | null;
}

export interface FiltrosBuscadorOdt {
  texto?: string;
  periodoId?: string;
  transportistaId?: string;
  placa?: string;
  estadoFenix?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface ResultadoBuscadorOdt {
  filas: OdtConRelaciones[];
  cursorSiguiente: string | null;
}

const TAMANO_PAGINA = 30;

/**
 * Búsqueda global de ODT con paginación por cursor (keyset, no OFFSET):
 * pensada para escalar con volúmenes grandes de ODT históricas, donde un
 * OFFSET creciente se vuelve cada vez más costoso. El cursor codifica
 * (fecha_creacion, id) de la última fila de la página anterior.
 */
export async function buscarOdt(
  filtros: FiltrosBuscadorOdt,
  cursor?: string | null,
): Promise<ResultadoBuscadorOdt> {
  const supabase = await createClient();

  let vehiculoIds: string[] | null = null;
  if (filtros.transportistaId) {
    const { data, error } = await supabase
      .from("vehiculo")
      .select("id")
      .eq("transportista_id", filtros.transportistaId);
    if (error) throw error;
    vehiculoIds = (data ?? []).map((v) => v.id);
    if (vehiculoIds.length === 0) return { filas: [], cursorSiguiente: null };
  }

  let query = supabase
    .from("odt")
    .select("*, vehiculo:vehiculo_id(id, placa, transportista:transportista_id(id, razon_social))")
    .order("fecha_creacion", { ascending: false })
    .order("id", { ascending: false })
    .limit(TAMANO_PAGINA);

  const texto = filtros.texto?.trim();
  if (texto) query = query.ilike("guia", `%${texto}%`);
  if (filtros.periodoId) query = query.eq("periodo_id", filtros.periodoId);
  if (filtros.placa) query = query.eq("placa_normalizada", filtros.placa.toUpperCase().replace(/[-\s]/g, ""));
  if (filtros.estadoFenix?.trim()) query = query.ilike("estado_fenix", `%${filtros.estadoFenix.trim()}%`);
  if (filtros.fechaDesde) query = query.gte("fecha_creacion", filtros.fechaDesde);
  if (filtros.fechaHasta) query = query.lte("fecha_creacion", filtros.fechaHasta);
  if (vehiculoIds) query = query.in("vehiculo_id", vehiculoIds);

  if (cursor) {
    const decodificado = decodificarCursor(cursor);
    if (decodificado) {
      const [fecha, id] = decodificado;
      query = query.or(`fecha_creacion.lt.${fecha},and(fecha_creacion.eq.${fecha},id.lt.${id})`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  const filas = (data ?? []) as unknown as OdtConRelaciones[];
  const ultima = filas.length === TAMANO_PAGINA ? filas[filas.length - 1] : undefined;
  const cursorSiguiente = ultima ? codificarCursor(ultima.fecha_creacion, ultima.id) : null;
  return { filas, cursorSiguiente };
}

function codificarCursor(fecha: string, id: string): string {
  return Buffer.from(`${fecha}|${id}`, "utf8").toString("base64url");
}

function decodificarCursor(cursor: string): [string, string] | null {
  try {
    const decodificado = Buffer.from(cursor, "base64url").toString("utf8");
    const separador = decodificado.indexOf("|");
    if (separador === -1) return null;
    return [decodificado.slice(0, separador), decodificado.slice(separador + 1)];
  } catch {
    return null;
  }
}
