import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Transportista = Database["public"]["Tables"]["transportista"]["Row"];
export type ContactoCorreo = Database["public"]["Tables"]["contacto_correo"]["Row"];

export interface ListarTransportistasParams {
  pagina: number; // 1-indexado
  tamanoPagina: number;
  busqueda?: string;
}

export interface ListarTransportistasResultado {
  filas: Transportista[];
  total: number;
}

export async function listarTransportistas({
  pagina,
  tamanoPagina,
  busqueda,
}: ListarTransportistasParams): Promise<ListarTransportistasResultado> {
  const supabase = await createClient();
  const desde = (pagina - 1) * tamanoPagina;
  const hasta = desde + tamanoPagina - 1;

  let query = supabase
    .from("transportista")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("razon_social", { ascending: true })
    .range(desde, hasta);

  if (busqueda && busqueda.trim() !== "") {
    const termino = busqueda.trim();
    query = query.or(`razon_social.ilike.%${termino}%,ruc.ilike.%${termino}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { filas: data ?? [], total: count ?? 0 };
}

export async function obtenerTransportista(id: string): Promise<Transportista | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("transportista").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarCorreosTransportista(transportistaId: string): Promise<ContactoCorreo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacto_correo")
    .select("*")
    .eq("transportista_id", transportistaId)
    .order("tipo", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
