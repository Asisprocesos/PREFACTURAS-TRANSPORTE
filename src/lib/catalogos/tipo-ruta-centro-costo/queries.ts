import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type TipoRutaCentroCosto = Database["public"]["Tables"]["tipo_ruta_centro_costo"]["Row"];

/** Ignora `macro`: el catálogo se administra solo como Tipo de Ruta -> Centro de Costo. */
export async function listarTipoRutaCentroCosto(): Promise<TipoRutaCentroCosto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipo_ruta_centro_costo")
    .select("*")
    .is("deleted_at", null)
    .order("tipo_ruta", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
