import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, EstadoLoteProceso, TipoLoteProceso } from "@/types/database.types";

import { ESTADOS_EN_CURSO } from "./estados";

export type LoteProceso = Database["public"]["Tables"]["lote_proceso"]["Row"];

export interface ListarEjecucionesParams {
  pagina: number;
  tamanoPagina: number;
  tipo?: TipoLoteProceso;
  estado?: EstadoLoteProceso;
}

export interface ListarEjecucionesResultado {
  filas: LoteProceso[];
  total: number;
}

/** Para la pantalla /ejecuciones: historial de lotes (PDF masivo, correo, carga de maestros), más recientes primero. */
export async function listarEjecuciones({
  pagina,
  tamanoPagina,
  tipo,
  estado,
}: ListarEjecucionesParams): Promise<ListarEjecucionesResultado> {
  const supabase = await createClient();
  const desde = (pagina - 1) * tamanoPagina;
  const hasta = desde + tamanoPagina - 1;

  let query = supabase
    .from("lote_proceso")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(desde, hasta);
  if (tipo) query = query.eq("tipo", tipo);
  if (estado) query = query.eq("estado", estado);

  const { data, error, count } = await query;
  if (error) throw error;
  return { filas: data ?? [], total: count ?? 0 };
}

/**
 * Lote PDF/MAESTROS sin terminar (PENDIENTE o PROCESANDO) para ofrecer
 * "Continuar"/"Cancelar" al volver a una pantalla en vez del botón normal.
 * CORREO no se busca acá: su propio flujo siempre redirige a
 * /prefacturas/lotes/{id} apenas se encola, así que no hace falta
 * detectarlo al cargar la página de Prefacturas.
 */
export async function obtenerLoteEnCurso(
  tipo: Extract<TipoLoteProceso, "PDF" | "MAESTROS">,
  periodoId?: string,
): Promise<LoteProceso | null> {
  const supabase = await createClient();
  let query = supabase
    .from("lote_proceso")
    .select("*")
    .eq("tipo", tipo)
    .in("estado", ESTADOS_EN_CURSO)
    .order("created_at", { ascending: false })
    .limit(1);
  if (periodoId) query = query.eq("periodo_id", periodoId);
  const { data } = await query.maybeSingle();
  return data ?? null;
}
