import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Vehiculo = Database["public"]["Tables"]["vehiculo"]["Row"];

export interface VehiculoConRelaciones extends Vehiculo {
  transportista: { id: string; razon_social: string; nombre: string | null } | null;
  regional: { id: string; nombre: string } | null;
}

export interface ListarVehiculosParams {
  pagina: number;
  tamanoPagina: number;
  busqueda?: string;
}

export interface ListarVehiculosResultado {
  filas: VehiculoConRelaciones[];
  total: number;
}

export async function listarVehiculos({
  pagina,
  tamanoPagina,
  busqueda,
}: ListarVehiculosParams): Promise<ListarVehiculosResultado> {
  const supabase = await createClient();
  const desde = (pagina - 1) * tamanoPagina;
  const hasta = desde + tamanoPagina - 1;

  let query = supabase
    .from("vehiculo")
    .select("*, transportista:transportista_id(id, razon_social, nombre), regional:regional_id(id, nombre)", {
      count: "exact",
    })
    .is("deleted_at", null)
    .order("placa", { ascending: true })
    .range(desde, hasta);

  if (busqueda && busqueda.trim() !== "") {
    query = query.ilike("placa", `%${busqueda.trim()}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { filas: (data ?? []) as unknown as VehiculoConRelaciones[], total: count ?? 0 };
}

export async function obtenerVehiculo(id: string): Promise<Vehiculo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehiculo").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarCorreosVehiculo(vehiculoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacto_correo")
    .select("*")
    .eq("vehiculo_id", vehiculoId)
    .order("tipo", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listarTransportistasParaSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transportista")
    .select("id, razon_social, nombre")
    .is("deleted_at", null)
    .eq("activo", true)
    .order("razon_social", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listarRegionalesParaSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regional")
    .select("id, nombre")
    .is("deleted_at", null)
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface EntradaHistorial {
  id: string;
  accion: string;
  fecha: string;
  usuario: string | null;
  antes: unknown;
  despues: unknown;
}

/** Historial de cambios del vehículo a partir de la auditoría genérica. */
export async function listarHistorialVehiculo(vehiculoId: string): Promise<EntradaHistorial[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auditoria")
    .select("id, accion, fecha, usuario, antes, despues")
    .eq("tabla", "vehiculo")
    .eq("registro_id", vehiculoId)
    .order("fecha", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
