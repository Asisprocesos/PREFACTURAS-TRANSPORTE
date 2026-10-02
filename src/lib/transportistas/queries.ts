import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ContactoCorreo } from "@/lib/contactos/types";
import type { Database } from "@/types/database.types";

export type { ContactoCorreo };

export type Transportista = Database["public"]["Tables"]["transportista"]["Row"];

export interface ListarTransportistasParams {
  pagina: number; // 1-indexado
  tamanoPagina: number;
  busqueda?: string;
  /** true: solo eliminados (papelera). false/omitido: solo activos (por defecto). */
  eliminados?: boolean;
}

export interface ListarTransportistasResultado {
  filas: Transportista[];
  total: number;
}

export async function listarTransportistas({
  pagina,
  tamanoPagina,
  busqueda,
  eliminados = false,
}: ListarTransportistasParams): Promise<ListarTransportistasResultado> {
  const supabase = await createClient();
  const desde = (pagina - 1) * tamanoPagina;
  const hasta = desde + tamanoPagina - 1;

  let query = supabase
    .from("transportista")
    .select("*", { count: "exact" })
    .order("razon_social", { ascending: true })
    .range(desde, hasta);
  query = eliminados ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);

  if (busqueda && busqueda.trim() !== "") {
    const termino = busqueda.trim();
    query = query.or(`razon_social.ilike.%${termino}%,nombre.ilike.%${termino}%,ruc.ilike.%${termino}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { filas: data ?? [], total: count ?? 0 };
}

/** Conteo liviano (sin traer filas) para el contador en vivo del listado. */
export async function contarTransportistas({
  eliminados = false,
  busqueda,
}: {
  eliminados?: boolean;
  busqueda?: string;
} = {}): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from("transportista").select("*", { count: "exact", head: true });
  query = eliminados ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);

  if (busqueda && busqueda.trim() !== "") {
    const termino = busqueda.trim();
    query = query.or(`razon_social.ilike.%${termino}%,nombre.ilike.%${termino}%,ruc.ilike.%${termino}%`);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function listarTransportistasParaSelect(): Promise<
  { id: string; razon_social: string; nombre: string | null }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transportista")
    .select("id, razon_social, nombre")
    .is("deleted_at", null)
    .order("razon_social", { ascending: true });
  if (error) throw error;
  return data ?? [];
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

export interface FilaSeguimientoTransportista {
  transportistaId: string;
  nombre: string;
  tipoTransportista: string | null;
  cantidadPrefacturas: number;
  totalFacturado: number;
}

export interface ResumenSeguimientoTipo {
  /** Nombre del tipo (ej. "FIJO"), o null para agrupar las prefacturas de transportistas sin tipo asignado. */
  tipo: string | null;
  cantidadTransportistas: number;
  cantidadPrefacturas: number;
  totalFacturado: number;
}

export interface SeguimientoTransportistas {
  porTransportista: FilaSeguimientoTransportista[];
  porTipo: ResumenSeguimientoTipo[];
}

/**
 * Cantidad de prefacturas y monto facturado por transportista en un
 * período, agrupado también por tipo_transportista (FIJO/BACK/lo que haya
 * en el catálogo, o "sin tipo asignado") — pedido del equipo de transporte
 * para llevar seguimiento de cuánto se está facturando por cada modalidad.
 * Incluye todas las prefacturas del período sin filtrar por estado ni por
 * es_principal, igual que el reporte "Prefacturas del período" y
 * dashboard_indicadores, para que el total coincida con esas pantallas.
 */
export async function obtenerSeguimientoTransportistas(
  periodoId: string,
): Promise<SeguimientoTransportistas> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prefactura")
    .select("id, total, transportista:transportista_id(id, razon_social, nombre, tipo_transportista)")
    .eq("periodo_id", periodoId);
  if (error) throw error;

  const porTransportista = new Map<string, FilaSeguimientoTransportista>();
  for (const p of data ?? []) {
    const t = p.transportista as unknown as {
      id: string;
      razon_social: string;
      nombre: string | null;
      tipo_transportista: string | null;
    } | null;
    if (!t) continue;

    const existente = porTransportista.get(t.id);
    if (existente) {
      existente.cantidadPrefacturas += 1;
      existente.totalFacturado += p.total;
    } else {
      porTransportista.set(t.id, {
        transportistaId: t.id,
        nombre: t.nombre?.trim() || t.razon_social,
        tipoTransportista: t.tipo_transportista,
        cantidadPrefacturas: 1,
        totalFacturado: p.total,
      });
    }
  }

  const filas = [...porTransportista.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const resumenPorClave = new Map<string, ResumenSeguimientoTipo & { transportistasVistos: Set<string> }>();
  for (const f of filas) {
    const clave = f.tipoTransportista?.toUpperCase() ?? "__SIN_TIPO__";
    const existente = resumenPorClave.get(clave);
    if (existente) {
      existente.cantidadPrefacturas += f.cantidadPrefacturas;
      existente.totalFacturado += f.totalFacturado;
      existente.transportistasVistos.add(f.transportistaId);
    } else {
      resumenPorClave.set(clave, {
        tipo: f.tipoTransportista,
        cantidadPrefacturas: f.cantidadPrefacturas,
        totalFacturado: f.totalFacturado,
        cantidadTransportistas: 0,
        transportistasVistos: new Set([f.transportistaId]),
      });
    }
  }

  const porTipo = [...resumenPorClave.values()]
    .map(({ transportistasVistos, ...resto }) => ({
      ...resto,
      cantidadTransportistas: transportistasVistos.size,
    }))
    .sort((a, b) => {
      if (a.tipo === null) return 1;
      if (b.tipo === null) return -1;
      return a.tipo.localeCompare(b.tipo);
    });

  return { porTransportista: filas, porTipo };
}
