import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, ResultadoMatchEscaneo } from "@/types/database.types";

import { calcularResumenValor } from "./resumen-valor";

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
  /** Valor de la ODT cargada (valor_final si existe, si no valor). Null cuando odt_id es null (ESCANEADA_NO_CARGADA). */
  valor: number | null;
}

export interface ResumenValorEscaneo {
  /** Suma del valor de las ODT esperadas (cargadas para este período/placa), escaneadas o no. */
  totalEsperado: number;
  /** Suma del valor de las ODT esperadas que sí se confirmaron con lectura física. */
  totalConfirmado: number;
  /** Suma del valor de las ODT esperadas que todavía no se han escaneado (totalEsperado - totalConfirmado). */
  totalFaltante: number;
}

export interface MatchSesion {
  filas: FilaMatch[];
  resumenValor: ResumenValorEscaneo;
}

/**
 * Match guía por guía (match_escaneo) más el comparativo de VALOR, que es
 * lo que de verdad le importa al operador: no basta con que las guías
 * coincidan, el monto de lo escaneado físicamente debe cuadrar con lo
 * cargado en el sistema. Se calcula aparte (no en la función SQL) sumando
 * el valor de las ODT esperadas/confirmadas, para no tener que tocar la
 * función de base de datos por un cálculo que es trivial hacer aquí.
 */
export async function obtenerMatchSesion(sesionId: string): Promise<MatchSesion> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_escaneo", { p_sesion_id: sesionId });
  if (error) throw error;
  const filasCrudas = (data ?? []) as Omit<FilaMatch, "valor">[];

  const odtIds = [...new Set(filasCrudas.map((f) => f.odt_id).filter((id): id is string => id !== null))];
  const valorPorOdtId = new Map<string, number>();
  if (odtIds.length > 0) {
    const { data: odts, error: errorOdt } = await supabase
      .from("odt")
      .select("id, valor, valor_final")
      .in("id", odtIds);
    if (errorOdt) throw errorOdt;
    for (const o of odts ?? []) valorPorOdtId.set(o.id, o.valor_final ?? o.valor);
  }

  const filas: FilaMatch[] = filasCrudas.map((f) => ({
    ...f,
    valor: f.odt_id ? (valorPorOdtId.get(f.odt_id) ?? null) : null,
  }));

  return { filas, resumenValor: calcularResumenValor(filas) };
}
