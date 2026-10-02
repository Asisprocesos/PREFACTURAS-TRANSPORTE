import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type TipoTransportista = Database["public"]["Tables"]["tipo_transportista"]["Row"];

export async function listarTipoTransportista(): Promise<TipoTransportista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipo_transportista")
    .select("*")
    .is("deleted_at", null)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
