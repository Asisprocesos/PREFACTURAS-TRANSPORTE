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
 *
 * El valor de las ODT esperadas (ESCANEADA_Y_CARGADA / CARGADA_SIN_FISICA)
 * se busca filtrando `odt` por período/placa — el mismo alcance que usa la
 * CTE "esperadas" de match_escaneo — en vez de armar un `.in(id, ...)` con
 * los ids que trae el match: en un período grande sin filtrar por placa
 * eso podía ser miles de ids en una sola consulta y reventaba la URL
 * (justo el error que rompía la página al abrir una sesión nueva).
 */
export async function obtenerMatchSesion(sesionId: string): Promise<MatchSesion> {
  const supabase = await createClient();
  const [{ data, error }, { data: sesion, error: errorSesion }] = await Promise.all([
    supabase.rpc("match_escaneo", { p_sesion_id: sesionId }),
    supabase.from("sesion_escaneo").select("periodo_id, placa").eq("id", sesionId).maybeSingle(),
  ]);
  if (error) throw error;
  if (errorSesion) throw errorSesion;
  const filasCrudas = (data ?? []) as Omit<FilaMatch, "valor">[];

  const valorPorOdtId = new Map<string, number>();
  if (sesion) {
    let query = supabase.from("odt").select("id, valor, valor_final").eq("periodo_id", sesion.periodo_id);
    if (sesion.placa) query = query.eq("placa_normalizada", sesion.placa);
    const { data: odts, error: errorOdt } = await query;
    if (errorOdt) throw errorOdt;
    for (const o of odts ?? []) valorPorOdtId.set(o.id, o.valor_final ?? o.valor);
  }

  // Una guía "de otra placa/período" queda fuera del filtro de arriba a
  // propósito (no es parte de lo esperado en esta sesión); se busca aparte,
  // acotado por cuántas se escanearon (nunca miles), para poder mostrar su
  // valor igual sin repetir el riesgo del `.in()` grande.
  const idsOtraPlacaOPeriodo = [
    ...new Set(
      filasCrudas
        .filter((f) => f.resultado === "OTRA_PLACA_O_PERIODO" && f.odt_id)
        .map((f) => f.odt_id as string),
    ),
  ];
  if (idsOtraPlacaOPeriodo.length > 0) {
    const { data: odts, error: errorOtras } = await supabase
      .from("odt")
      .select("id, valor, valor_final")
      .in("id", idsOtraPlacaOPeriodo);
    if (errorOtras) throw errorOtras;
    for (const o of odts ?? []) valorPorOdtId.set(o.id, o.valor_final ?? o.valor);
  }

  const filas: FilaMatch[] = filasCrudas.map((f) => ({
    ...f,
    valor: f.odt_id ? (valorPorOdtId.get(f.odt_id) ?? null) : null,
  }));

  return { filas, resumenValor: calcularResumenValor(filas) };
}
