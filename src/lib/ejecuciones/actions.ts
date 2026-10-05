"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";
import type { TipoLoteProceso } from "@/types/database.types";

import { obtenerLoteEnCurso, type LoteProceso } from "./queries";

export interface ResultadoCrearLote extends ResultadoAccion {
  loteId?: string;
}

/**
 * Abre un lote_proceso para una ejecución larga que corre como un loop en
 * el cliente (PDF masivo, carga de maestros) — a diferencia de CORREO, que
 * ya se procesa server-side vía pg_cron. Este lote solo sirve de "tablero":
 * quien dispara el loop (generar-todos-pdf-button.tsx,
 * formulario-importar-maestros.tsx) va incrementando su progreso con
 * incrementarProgresoLoteAction, y cualquier pantalla puede detectar un
 * lote PENDIENTE/PROCESANDO sin terminar y ofrecer continuar o cancelar.
 */
export async function crearLoteAction(datos: {
  tipo: Extract<TipoLoteProceso, "PDF" | "MAESTROS">;
  total: number;
  periodoId?: string;
  detalle: string;
}): Promise<ResultadoCrearLote> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lote_proceso")
    .insert({
      tipo: datos.tipo,
      total: datos.total,
      periodo_id: datos.periodoId ?? null,
      detalle: datos.detalle,
      iniciado_por: perfil.userId,
      estado: "PROCESANDO",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo iniciar la ejecución." };

  revalidatePath("/ejecuciones");
  return { ok: true, loteId: data.id };
}

/** Wrapper de la RPC incrementar_progreso_lote para llamarla desde un loop en el cliente tras cada ítem procesado. */
export async function incrementarProgresoLoteAction(loteId: string, exitoso: boolean): Promise<void> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();
  await supabase.rpc("incrementar_progreso_lote", { p_lote_id: loteId, p_exitoso: exitoso });
}

/** Para que un botón "Continuar" retome el mismo lote en vez de crear uno nuevo. */
export async function obtenerLoteEnCursoAction(
  tipo: Extract<TipoLoteProceso, "PDF" | "MAESTROS">,
  periodoId?: string,
): Promise<LoteProceso | null> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  return obtenerLoteEnCurso(tipo, periodoId);
}

/**
 * Cancela una ejecución PENDIENTE/PROCESANDO, de cualquier tipo. Para PDF y
 * MAESTROS basta con marcar el lote: el loop que corre en el navegador de
 * quien lo inició revisa el estado del lote entre ítem e ítem y se detiene
 * solo (y si ya nadie lo está mirando, simplemente no hay nada más que
 * procesar). Para CORREO hay que además sacar de la cola los envíos que el
 * worker de pg_cron todavía no tomó (si no, igual los envía) y devolver esas
 * prefacturas a un estado normal — si no, se quedarían en EN_COLA_ENVIO
 * para siempre sin que nada las vuelva a ofrecer para reenviar.
 */
export async function cancelarLoteAction(loteId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: lote, error: errorLote } = await supabase
    .from("lote_proceso")
    .select("*")
    .eq("id", loteId)
    .maybeSingle();
  if (errorLote || !lote) return { ok: false, error: "No se encontró la ejecución." };
  if (lote.estado !== "PENDIENTE" && lote.estado !== "PROCESANDO") {
    return { ok: false, error: "Esta ejecución ya terminó, no se puede cancelar." };
  }

  if (lote.tipo === "CORREO") {
    const { data: pendientes } = await supabase
      .from("envio_correo")
      .select("prefactura_id, prefactura_ids")
      .eq("lote_id", loteId)
      .in("estado", ["PENDIENTE", "REINTENTAR"]);

    const { error: errorEnvios } = await supabase
      .from("envio_correo")
      .update({ estado: "CANCELADO" })
      .eq("lote_id", loteId)
      .in("estado", ["PENDIENTE", "REINTENTAR"]);
    if (errorEnvios) return { ok: false, error: "No se pudieron cancelar los envíos pendientes." };

    const prefacturaIds = new Set<string>();
    for (const envio of pendientes ?? []) {
      if (envio.prefactura_id) prefacturaIds.add(envio.prefactura_id);
      for (const id of envio.prefactura_ids ?? []) prefacturaIds.add(id);
    }
    if (prefacturaIds.size > 0) {
      // Solo revierte las que el worker no haya tomado mientras tanto (si ya
      // pasó a ENVIADA/ERROR_ENVIO, esa es la verdad y no hay que tocarla).
      await supabase
        .from("prefactura")
        .update({ estado: "PDF_GENERADO" })
        .in("id", [...prefacturaIds])
        .eq("estado", "EN_COLA_ENVIO");
    }
  }

  const { error } = await supabase.from("lote_proceso").update({ estado: "CANCELADO" }).eq("id", loteId);
  if (error) return { ok: false, error: "No se pudo cancelar la ejecución." };

  revalidatePath("/ejecuciones");
  revalidatePath("/prefacturas");
  revalidatePath("/transportistas/importar");
  if (lote.tipo === "CORREO") revalidatePath(`/prefacturas/lotes/${loteId}`);
  return { ok: true };
}
