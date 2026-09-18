import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface IndicadoresDashboard {
  totalPrefacturas: number;
  prefacturasBorrador: number;
  prefacturasConNovedades: number;
  prefacturasListas: number;
  prefacturasPdfGenerado: number;
  prefacturasEnColaEnvio: number;
  prefacturasEnviadas: number;
  prefacturasErrorEnvio: number;
  montoTotalPrefacturado: number;
  totalOdt: number;
  totalTransportistasActivos: number;
  totalVehiculosActivos: number;
  novedadesAbiertasError: number;
  novedadesAbiertasAdvertencia: number;
  novedadesAbiertasInfo: number;
}

const INDICADORES_VACIOS: IndicadoresDashboard = {
  totalPrefacturas: 0,
  prefacturasBorrador: 0,
  prefacturasConNovedades: 0,
  prefacturasListas: 0,
  prefacturasPdfGenerado: 0,
  prefacturasEnColaEnvio: 0,
  prefacturasEnviadas: 0,
  prefacturasErrorEnvio: 0,
  montoTotalPrefacturado: 0,
  totalOdt: 0,
  totalTransportistasActivos: 0,
  totalVehiculosActivos: 0,
  novedadesAbiertasError: 0,
  novedadesAbiertasAdvertencia: 0,
  novedadesAbiertasInfo: 0,
};

export async function obtenerIndicadoresDashboard(periodoId: string | null): Promise<IndicadoresDashboard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_indicadores", { p_periodo_id: periodoId });
  if (error) throw error;
  const fila = data?.[0];
  if (!fila) return INDICADORES_VACIOS;
  return {
    totalPrefacturas: fila.total_prefacturas,
    prefacturasBorrador: fila.prefacturas_borrador,
    prefacturasConNovedades: fila.prefacturas_con_novedades,
    prefacturasListas: fila.prefacturas_listas,
    prefacturasPdfGenerado: fila.prefacturas_pdf_generado,
    prefacturasEnColaEnvio: fila.prefacturas_en_cola_envio,
    prefacturasEnviadas: fila.prefacturas_enviadas,
    prefacturasErrorEnvio: fila.prefacturas_error_envio,
    montoTotalPrefacturado: fila.monto_total_prefacturado,
    totalOdt: fila.total_odt,
    totalTransportistasActivos: fila.total_transportistas_activos,
    totalVehiculosActivos: fila.total_vehiculos_activos,
    novedadesAbiertasError: fila.novedades_abiertas_error,
    novedadesAbiertasAdvertencia: fila.novedades_abiertas_advertencia,
    novedadesAbiertasInfo: fila.novedades_abiertas_info,
  };
}

export interface PuntoPrefacturasPorEstado {
  estado: string;
  cantidad: number;
}

export async function obtenerPrefacturasPorEstado(periodoId: string | null): Promise<PuntoPrefacturasPorEstado[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_prefacturas_por_estado", { p_periodo_id: periodoId });
  if (error) throw error;
  return (data ?? []).map((f) => ({ estado: f.estado, cantidad: f.cantidad }));
}

export interface PuntoMonto {
  nombre: string;
  monto: number;
  cantidad: number;
}

export async function obtenerMontoPorCentroCosto(periodoId: string | null, limite = 12): Promise<PuntoMonto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_monto_por_centro_costo", {
    p_periodo_id: periodoId,
    p_limite: limite,
  });
  if (error) throw error;
  return (data ?? []).map((f) => ({ nombre: f.centro_costo, monto: f.monto, cantidad: f.cantidad }));
}

export async function obtenerMontoPorRegional(periodoId: string | null): Promise<PuntoMonto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_monto_por_regional", { p_periodo_id: periodoId });
  if (error) throw error;
  return (data ?? []).map((f) => ({ nombre: f.regional, monto: f.monto, cantidad: f.cantidad }));
}

export interface PuntoTopPlaca {
  placa: string;
  transportista: string | null;
  monto: number;
  cantidad: number;
}

export async function obtenerTopPlacas(periodoId: string | null, limite = 10): Promise<PuntoTopPlaca[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_top_placas", {
    p_periodo_id: periodoId,
    p_limite: limite,
  });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    placa: f.placa,
    transportista: f.transportista,
    monto: f.monto,
    cantidad: f.cantidad,
  }));
}
