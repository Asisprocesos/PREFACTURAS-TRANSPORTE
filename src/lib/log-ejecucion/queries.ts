import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, EstadoLogEjecucion, EtapaLogEjecucion } from "@/types/database.types";

export type LogEjecucion = Database["public"]["Tables"]["log_ejecucion"]["Row"];

export interface FiltrosLogEjecucion {
  guia?: string;
  etapa?: EtapaLogEjecucion;
  estado?: EstadoLogEjecucion;
  desde?: string;
  hasta?: string;
}

export interface ListarLogEjecucionParams extends FiltrosLogEjecucion {
  pagina: number;
  tamanoPagina: number;
}

export async function listarLogEjecucion({
  pagina,
  tamanoPagina,
  guia,
  etapa,
  estado,
  desde,
  hasta,
}: ListarLogEjecucionParams): Promise<{ filas: LogEjecucion[]; total: number }> {
  const supabase = await createClient();
  const desdeIdx = (pagina - 1) * tamanoPagina;
  const hastaIdx = desdeIdx + tamanoPagina - 1;

  let query = supabase
    .from("log_ejecucion")
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false })
    .range(desdeIdx, hastaIdx);

  if (guia?.trim()) query = query.ilike("guia", `%${guia.trim()}%`);
  if (etapa) query = query.eq("etapa", etapa);
  if (estado) query = query.eq("estado", estado);
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);

  const { data, error, count } = await query;
  if (error) throw error;
  return { filas: data ?? [], total: count ?? 0 };
}
