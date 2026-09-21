import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { ResumenValidacion } from "./validar-action";

/**
 * Recalcula el resumen (leídas/válidas/con error/advertencias/excluidas)
 * desde el staging real y sincroniza los contadores persistidos en
 * `importacion`. Se usa después de cualquier corrección manual de una fila,
 * porque `validarImportacionAction` solo calcula el resumen una vez, al
 * validar el archivo completo.
 *
 * "Excluida" se deriva de `datos_normalizados.estadoFenix` (no hay columna
 * `excluida` en `importacion_fila`) con la misma regla que `validarFila`:
 * cualquier estado distinto de "Entregado" (sin distinguir mayúsculas).
 */
export async function recalcularResumenImportacion(importacionId: string): Promise<ResumenValidacion> {
  const supabase = await createClient();
  const { data: filas, error } = await supabase
    .from("importacion_fila")
    .select("errores, advertencias, datos_normalizados")
    .eq("importacion_id", importacionId);
  if (error) throw error;

  const resumen: ResumenValidacion = {
    filasLeidas: filas?.length ?? 0,
    filasValidas: 0,
    filasConError: 0,
    filasAdvertencias: 0,
    filasExcluidas: 0,
  };

  for (const f of filas ?? []) {
    const errores = (f.errores as string[] | null) ?? [];
    const advertencias = (f.advertencias as string[] | null) ?? [];
    const estado = (f.datos_normalizados as { estadoFenix?: string | null } | null)?.estadoFenix ?? "";
    const excluida = estado.toLowerCase() !== "entregado";

    if (excluida) resumen.filasExcluidas++;
    else if (errores.length > 0) resumen.filasConError++;
    else if (advertencias.length > 0) resumen.filasAdvertencias++;
    else resumen.filasValidas++;
  }

  await supabase
    .from("importacion")
    .update({
      filas_validas: resumen.filasValidas,
      filas_con_error: resumen.filasConError,
      filas_advertencias: resumen.filasAdvertencias,
    })
    .eq("id", importacionId);

  return resumen;
}
