import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, EstadoLogEjecucion, EtapaLogEjecucion, Json } from "@/types/database.types";

export interface EntradaLogEjecucion {
  guia: string;
  estado: EstadoLogEjecucion;
  detalle?: Json;
}

/**
 * Registra una fila de `log_ejecucion` por cada ODT de un lote (PDF
 * generado, correo enviado/fallido). `ejecucionId` agrupa las filas de una
 * misma corrida (el id de `documento_pdf` o de `envio_correo`, según la
 * etapa) para poder reconstruir qué pasó en una ejecución puntual.
 */
export async function registrarLogEjecucion(
  supabase: SupabaseClient<Database>,
  ejecucionId: string,
  etapa: EtapaLogEjecucion,
  entradas: EntradaLogEjecucion[],
): Promise<void> {
  if (entradas.length === 0) return;
  await supabase.from("log_ejecucion").insert(
    entradas.map((e) => ({
      ejecucion_id: ejecucionId,
      guia: e.guia,
      etapa,
      estado: e.estado,
      detalle: e.detalle ?? null,
    })),
  );
}

/** Guías de las ODT incluidas en una prefactura, para loguear por ODT las etapas PDF/CORREO. */
export async function obtenerGuiasPrefactura(
  supabase: SupabaseClient<Database>,
  prefacturaId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("prefactura_detalle")
    .select("odt:odt_id(guia)")
    .eq("prefactura_id", prefacturaId);
  return ((data ?? []) as unknown as { odt: { guia: string } | null }[])
    .map((f) => f.odt?.guia)
    .filter((g): g is string => Boolean(g));
}
