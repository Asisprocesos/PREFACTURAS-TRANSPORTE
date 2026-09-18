import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type PrefacturaReporte = Database["public"]["Tables"]["prefactura"]["Row"] & {
  vehiculo: { placa: string } | null;
  transportista: { razon_social: string; ruc: string } | null;
  periodo: { nombre: string } | null;
};

// Tope de seguridad: una prefactura es única por (vehículo, período), así
// que el máximo real por período está acotado por la flota activa; 5000
// cubre con margen cualquier volumen realista de LAARCOURIER.
const TOPE_FILAS_REPORTE = 5000;

export async function obtenerPrefacturasReporte(
  periodoId: string,
  transportistaId?: string,
): Promise<PrefacturaReporte[]> {
  const supabase = await createClient();
  let query = supabase
    .from("prefactura")
    .select(
      "*, vehiculo:vehiculo_id(placa), transportista:transportista_id(razon_social, ruc), periodo:periodo_id(nombre)",
    )
    .eq("periodo_id", periodoId)
    .order("created_at", { ascending: true })
    .limit(TOPE_FILAS_REPORTE);
  if (transportistaId) query = query.eq("transportista_id", transportistaId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PrefacturaReporte[];
}

export async function obtenerUltimosErroresEnvio(prefacturaIds: string[]): Promise<Map<string, string>> {
  if (prefacturaIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("envio_correo")
    .select("prefactura_id, error, created_at")
    .in("prefactura_id", prefacturaIds)
    .eq("estado", "ERROR")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const mapa = new Map<string, string>();
  for (const fila of data ?? []) {
    if (!mapa.has(fila.prefactura_id) && fila.error) mapa.set(fila.prefactura_id, fila.error);
  }
  return mapa;
}

export interface NovedadFueraDePeriodo {
  id: string;
  placa: string | null;
  transportista: string | null;
  periodo: string | null;
  valor: number | null;
  facturado: boolean;
  resolucion: string | null;
  estado: string;
}

/**
 * Réplica de la hoja REZAGOS del Excel original: ODT cuya fecha de creación
 * cayó fuera del rango del período (novedad tipo "fecha fuera de corte").
 * `resolucion` guarda en texto libre la alternativa elegida (mover, rezago,
 * excluir, corregir) porque el modelo no tiene un enum dedicado para eso.
 */
export async function obtenerNovedadesFueraDePeriodo(periodoId: string): Promise<NovedadFueraDePeriodo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("novedad")
    .select("id, placa, mensaje, resolucion, estado, periodo:periodo_id(nombre), entidad, entidad_id")
    .eq("periodo_id", periodoId)
    .ilike("mensaje", "%fuera del rango del período%")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const filas = (data ?? []) as unknown as {
    id: string;
    placa: string | null;
    resolucion: string | null;
    estado: string;
    periodo: { nombre: string } | null;
    entidad: string;
    entidad_id: string | null;
  }[];

  const odtIds = filas.filter((f) => f.entidad === "odt" && f.entidad_id).map((f) => f.entidad_id!);
  const odtPorId = new Map<
    string,
    {
      valor_final: number | null;
      valor: number;
      vehiculo: { transportista: { razon_social: string } | null } | null;
    }
  >();
  if (odtIds.length > 0) {
    const { data: odtData } = await supabase
      .from("odt")
      .select("id, valor_final, valor, vehiculo:vehiculo_id(transportista:transportista_id(razon_social))")
      .in("id", odtIds);
    for (const o of (odtData ?? []) as unknown as {
      id: string;
      valor_final: number | null;
      valor: number;
      vehiculo: { transportista: { razon_social: string } | null } | null;
    }[]) {
      odtPorId.set(o.id, o);
    }
  }

  const prefacturadas = new Set<string>();
  if (odtIds.length > 0) {
    const { data: detalles } = await supabase
      .from("prefactura_detalle")
      .select("odt_id")
      .in("odt_id", odtIds);
    for (const d of detalles ?? []) prefacturadas.add(d.odt_id);
  }

  return filas.map((f) => {
    const odt = f.entidad_id ? odtPorId.get(f.entidad_id) : undefined;
    return {
      id: f.id,
      placa: f.placa,
      transportista: odt?.vehiculo?.transportista?.razon_social ?? null,
      periodo: f.periodo?.nombre ?? null,
      valor: odt ? (odt.valor_final ?? odt.valor) : null,
      facturado: f.entidad_id ? prefacturadas.has(f.entidad_id) : false,
      resolucion: f.resolucion,
      estado: f.estado,
    };
  });
}

export interface PuntoMonto {
  nombre: string;
  monto: number;
  cantidad: number;
}

export async function obtenerResumenCentroCostoCompleto(periodoId: string): Promise<PuntoMonto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_monto_por_centro_costo", {
    p_periodo_id: periodoId,
    p_limite: 500,
  });
  if (error) throw error;
  return (data ?? []).map((f) => ({ nombre: f.centro_costo, monto: f.monto, cantidad: f.cantidad }));
}
