import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type LoteProceso = Database["public"]["Tables"]["lote_proceso"]["Row"];
export type EnvioCorreo = Database["public"]["Tables"]["envio_correo"]["Row"];

export interface ContactosPrefactura {
  principal: string | null;
  adicionales: string[];
}

/** Correos del vehículo y, si no tiene, del transportista (PRINCIPAL primero). */
export async function obtenerContactosPrefactura(
  vehiculoId: string | null,
  transportistaId: string | null,
): Promise<ContactosPrefactura> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacto_correo")
    .select("email, tipo, vehiculo_id, transportista_id")
    .or(
      [
        vehiculoId ? `vehiculo_id.eq.${vehiculoId}` : null,
        transportistaId ? `transportista_id.eq.${transportistaId}` : null,
      ]
        .filter(Boolean)
        .join(","),
    )
    .eq("activo", true);

  const correos = data ?? [];
  const principal = correos.find((c) => c.tipo === "PRINCIPAL")?.email ?? null;
  const adicionales = correos.filter((c) => c.email !== principal).map((c) => c.email);
  return { principal, adicionales };
}

export async function obtenerLoteProceso(id: string): Promise<LoteProceso | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lote_proceso").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarEnviosLote(loteId: string): Promise<EnvioCorreo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("envio_correo")
    .select("*")
    .eq("lote_id", loteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
