import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Odt = Database["public"]["Tables"]["odt"]["Row"];
export type OdtCorreccion = Database["public"]["Tables"]["odt_correccion"]["Row"];

export async function obtenerOdtPorGuia(guia: string): Promise<Odt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("odt").select("*").eq("guia", guia).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarCorreccionesOdt(odtId: string): Promise<OdtCorreccion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("odt_correccion")
    .select("*")
    .eq("odt_id", odtId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** ODT con un tipo_ruta dado en un período, para la corrección masiva. */
export async function listarOdtPorTipoRuta(periodoId: string, tipoRuta: string): Promise<Odt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("odt")
    .select("*")
    .eq("periodo_id", periodoId)
    .eq("tipo_ruta", tipoRuta);
  if (error) throw error;
  return data ?? [];
}
