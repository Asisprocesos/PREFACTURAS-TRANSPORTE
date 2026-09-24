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
  /** true: solo eliminados (papelera). false/omitido: solo activos (por defecto). */
  eliminados?: boolean;
}

export interface ListarVehiculosResultado {
  filas: VehiculoConRelaciones[];
  total: number;
}

export async function listarVehiculos({
  pagina,
  tamanoPagina,
  busqueda,
  eliminados = false,
}: ListarVehiculosParams): Promise<ListarVehiculosResultado> {
  const supabase = await createClient();
  const desde = (pagina - 1) * tamanoPagina;
  const hasta = desde + tamanoPagina - 1;

  let query = supabase
    .from("vehiculo")
    .select("*, transportista:transportista_id(id, razon_social, nombre), regional:regional_id(id, nombre)", {
      count: "exact",
    })
    .order("placa", { ascending: true })
    .range(desde, hasta);
  query = eliminados ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);

  if (busqueda && busqueda.trim() !== "") {
    query = query.ilike("placa", `%${busqueda.trim()}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { filas: (data ?? []) as unknown as VehiculoConRelaciones[], total: count ?? 0 };
}

/** Conteo liviano (sin traer filas) para el contador en vivo del listado. */
export async function contarVehiculos({
  eliminados = false,
  busqueda,
}: {
  eliminados?: boolean;
  busqueda?: string;
} = {}): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from("vehiculo").select("*", { count: "exact", head: true });
  query = eliminados ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);

  if (busqueda && busqueda.trim() !== "") {
    query = query.ilike("placa", `%${busqueda.trim()}%`);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function obtenerVehiculo(id: string): Promise<Vehiculo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehiculo").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Usado por el enlace "Corregir" del importador para saltar directo al vehículo de una placa. */
export async function obtenerVehiculoIdPorPlaca(placa: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehiculo")
    .select("id")
    .eq("placa", placa)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export interface ConductorVigente {
  id: string;
  nombre: string;
  vigenteDesde: string;
}

/** Conductor asignado actualmente a un vehículo (vigente_hasta null), si hay alguno registrado. */
export async function obtenerConductorVigente(vehiculoId: string): Promise<ConductorVigente | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehiculo_conductor")
    .select("vigente_desde, conductor:conductor_id(id, nombres, apellidos)")
    .eq("vehiculo_id", vehiculoId)
    .is("vigente_hasta", null)
    .maybeSingle();
  if (error || !data) return null;

  const conductor = data.conductor as unknown as {
    id: string;
    nombres: string | null;
    apellidos: string | null;
  };
  const nombre = [conductor.nombres, conductor.apellidos].filter(Boolean).join(" ").trim();
  if (!nombre) return null;
  return { id: conductor.id, nombre, vigenteDesde: data.vigente_desde };
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
    .select("id, razon_social, nombre, ruc")
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
