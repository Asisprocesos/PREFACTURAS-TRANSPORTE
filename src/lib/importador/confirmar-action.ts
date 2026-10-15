"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { marcarRequiereRegenerar, recalcularTotalesPrefacturasDeOdt } from "@/lib/odt/actions";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { recalcularResumenImportacion } from "./resumen";
import type { ResumenValidacion } from "./validar-action";

export interface ResultadoConfirmacionLote extends ResultadoAccion {
  odtInsertadas?: number;
  odtActualizadas?: number;
  novedadesGeneradas?: number;
  /** Filas con decision IN (INSERTAR, ACTUALIZAR) que todavía no se han procesado: si es > 0, hay que volver a llamar. */
  filasRestantes?: number;
}

/**
 * Tras actualizar una ODT (decision=ACTUALIZAR, "Actualizar existentes" del
 * importador), se repite el mismo efecto que una corrección manual desde
 * /odt/{guia}/corregir: si la prefactura que la incluye ya tenía PDF
 * vigente, se marca REQUIERE_REGENERAR, y se recalculan sus totales — si no
 * se tocara, un envío posterior saldría con el PDF viejo o con el total
 * desactualizado.
 */
async function marcarRegenerarPorGuias(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guias: string[],
): Promise<void> {
  if (guias.length === 0) return;
  const { data: odts } = await supabase.from("odt").select("id").in("guia", guias);
  for (const odt of odts ?? []) {
    await marcarRequiereRegenerar(odt.id);
    await recalcularTotalesPrefacturasDeOdt(odt.id);
  }
}

/**
 * Confirma un lote chico (por defecto 300 filas) en vez de todo el archivo
 * de una sola vez — el cliente la llama en un ciclo hasta que
 * `filasRestantes` llega a 0 (ver `confirmar()` en detalle-importacion.tsx
 * e importar-wizard.tsx). Es idempotente: cada lote solo toma filas sin
 * procesar (`importacion_fila.procesada = false`), así que reintentar un
 * lote fallido nunca duplica ni reprocesa nada.
 */
export async function confirmarLoteImportacionAction(
  importacionId: string,
  tamanoLote = 300,
): Promise<ResultadoConfirmacionLote> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("confirmar_importacion_lote", {
    p_importacion_id: importacionId,
    p_tamano_lote: tamanoLote,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  const resumen = data?.[0];
  await marcarRegenerarPorGuias(supabase, resumen?.guias_actualizadas ?? []);

  if (!resumen || resumen.filas_restantes === 0) {
    revalidatePath(`/importar/${importacionId}`);
    revalidatePath("/importar");
    revalidatePath("/prefacturas");
  }
  return {
    ok: true,
    odtInsertadas: resumen?.odt_insertadas,
    odtActualizadas: resumen?.odt_actualizadas,
    novedadesGeneradas: resumen?.novedades_generadas,
    filasRestantes: resumen?.filas_restantes,
  };
}

export async function revertirImportacionAction(importacionId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("revertir_importacion", { p_importacion_id: importacionId });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/importar/${importacionId}`);
  revalidatePath("/importar");
  return { ok: true };
}

/**
 * Permite decidir manualmente una fila puntual antes de confirmar (Omitir /
 * Insertar de todas formas). Se usa desde la pestaña de Advertencias, donde
 * la fila ya no tiene errores estructurales y forzar la decisión es seguro.
 * Para filas con errores reales, usar `corregirFilaImportacionAction`: solo
 * pasan a INSERTAR una vez que la revalidación confirma que ya no violan
 * ninguna regla (evita que un error como "guía duplicada" rompa la
 * confirmación completa del lote por violar la restricción única de `odt`).
 */
export async function establecerDecisionFilaAction(
  filaId: string,
  decision: "INSERTAR" | "OMITIR",
): Promise<ResultadoAccion & { resumen?: ResumenValidacion }> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: fila, error } = await supabase
    .from("importacion_fila")
    .update({ decision })
    .eq("id", filaId)
    .select("importacion_id")
    .single();
  if (error || !fila) return { ok: false, error: "No se pudo actualizar la decisión." };

  const resumen = await recalcularResumenImportacion(fila.importacion_id);
  return { ok: true, resumen };
}
