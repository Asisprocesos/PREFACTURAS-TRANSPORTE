import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, ResultadoMatchEscaneo } from "@/types/database.types";

export type SesionEscaneo = Database["public"]["Tables"]["sesion_escaneo"]["Row"];
export type EscaneoOdt = Database["public"]["Tables"]["escaneo_odt"]["Row"];

export async function obtenerSesionEscaneo(id: string): Promise<SesionEscaneo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sesion_escaneo").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarEscaneosSesion(sesionId: string): Promise<EscaneoOdt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("escaneo_odt")
    .select("*")
    .eq("sesion_id", sesionId)
    .order("escaneado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface FilaMatch {
  guia: string;
  resultado: ResultadoMatchEscaneo;
  odt_id: string | null;
}

export async function obtenerMatchSesion(sesionId: string): Promise<FilaMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_escaneo", { p_sesion_id: sesionId });
  if (error) throw error;
  return (data ?? []) as FilaMatch[];
}
