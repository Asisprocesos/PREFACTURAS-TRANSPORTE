import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Importacion = Database["public"]["Tables"]["importacion"]["Row"];
export type ImportacionFila = Database["public"]["Tables"]["importacion_fila"]["Row"];

export async function obtenerImportacion(id: string): Promise<Importacion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("importacion").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export type PestanaFilas = "errores" | "advertencias" | "validas" | "todas";

export interface ListarFilasParams {
  importacionId: string;
  pestana: PestanaFilas;
  pagina: number;
  tamanoPagina: number;
}

export async function listarFilasImportacion({
  importacionId,
  pestana,
  pagina,
  tamanoPagina,
}: ListarFilasParams): Promise<{ filas: ImportacionFila[]; total: number }> {
  const supabase = await createClient();
  const desde = (pagina - 1) * tamanoPagina;
  const hasta = desde + tamanoPagina - 1;

  let query = supabase
    .from("importacion_fila")
    .select("*", { count: "exact" })
    .eq("importacion_id", importacionId)
    .order("numero_fila", { ascending: true })
    .range(desde, hasta);

  if (pestana === "errores") {
    query = query.neq("errores", "[]");
  } else if (pestana === "advertencias") {
    query = query.eq("errores", "[]").neq("advertencias", "[]");
  } else if (pestana === "validas") {
    query = query.eq("errores", "[]").eq("advertencias", "[]");
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { filas: data ?? [], total: count ?? 0 };
}

export async function listarPeriodosParaSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("periodo")
    .select("id, numero, nombre, fecha_inicio, fecha_fin, estado")
    .neq("estado", "ARCHIVADO")
    .order("fecha_inicio", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listarImportacionesRecientes(limite = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("importacion")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}
