"use server";

import { randomUUID } from "crypto";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";
import type { DecisionFila, Json } from "@/types/database.types";

import type { CampoOdt } from "./campos";
import { construirContextoBase, type ResumenValidacion } from "./validar-action";
import { validarFila, type FilaValidada } from "./validar";

/**
 * Ingreso manual de ODT (sin archivo Excel), para cuando solo hay que
 * cargar una o dos prefacturas puntuales. Reusa exactamente la misma
 * `validarFila()` y el mismo staging `importacion_fila` -> RPC
 * `confirmar_importacion_lote` que la carga masiva (ver validar-action.ts /
 * confirmar-action.ts): la única diferencia es que las filas del staging
 * vienen de un formulario en vez de parsear un Excel.
 */

/** Valida en vivo una fila mientras se arma la lista, antes de guardar nada. */
export async function validarFilaManualAction(datos: {
  periodoId: string;
  fila: Partial<Record<CampoOdt, string>>;
  /** Guías ya agregadas a la lista en esta sesión (para detectar duplicados entre ellas). */
  guiasEnLista: string[];
}): Promise<FilaValidada> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const contextoBase = await construirContextoBase(supabase, datos.periodoId);

  const guia = (datos.fila.guia ?? "").trim().toUpperCase();
  const { data: enBD } = guia
    ? await supabase.from("odt").select("guia").eq("guia", guia).maybeSingle()
    : { data: null };

  const guiasVistasEnArchivo = new Set(
    datos.guiasEnLista.map((g) => g.trim().toUpperCase()).filter((g) => g && g !== guia),
  );

  return validarFila(
    1,
    datos.fila,
    { ...contextoBase, guiasExistentesBD: new Set(enBD ? [guia] : []) },
    guiasVistasEnArchivo,
  );
}

export interface ResultadoImportacionManual extends ResultadoAccion {
  importacionId?: string;
  resumen?: ResumenValidacion;
}

/**
 * Registra la lista completa como una `importacion` (archivo = "Ingreso
 * manual") con sus `importacion_fila`, re-validando cada fila server-side
 * (la validación en vivo de `validarFilaManualAction` es solo para feedback
 * del formulario). El cliente confirma el resultado llamando a
 * `confirmarLoteImportacionAction`, igual que al final del asistente de
 * carga masiva.
 */
export async function crearImportacionManualAction(datos: {
  periodoId: string;
  filas: Partial<Record<CampoOdt, string>>[];
}): Promise<ResultadoImportacionManual> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  if (datos.filas.length === 0) return { ok: false, error: "Agrega al menos una fila antes de confirmar." };

  const supabase = await createClient();
  const contextoBase = await construirContextoBase(supabase, datos.periodoId);

  const guiasEnLote = new Set(datos.filas.map((f) => (f.guia ?? "").trim().toUpperCase()).filter(Boolean));
  const { data: enBD } =
    guiasEnLote.size > 0
      ? await supabase
          .from("odt")
          .select("guia")
          .in("guia", [...guiasEnLote])
      : { data: [] as { guia: string }[] };
  const guiasExistentesBD = new Set((enBD ?? []).map((o) => o.guia.toUpperCase()));

  const guiasVistasEnArchivo = new Set<string>();
  const resumen: ResumenValidacion = {
    filasLeidas: datos.filas.length,
    filasValidas: 0,
    filasConError: 0,
    filasAdvertencias: 0,
    filasExcluidas: 0,
    filasParaInsertar: 0,
  };

  const filasParaInsertarEnBD = datos.filas.map((fila, i) => {
    const resultado = validarFila(i + 1, fila, { ...contextoBase, guiasExistentesBD }, guiasVistasEnArchivo);

    if (resultado.excluida) resumen.filasExcluidas++;
    else if (resultado.errores.length > 0) resumen.filasConError++;
    else if (resultado.advertencias.length > 0) resumen.filasAdvertencias++;
    else resumen.filasValidas++;

    const decision: DecisionFila = resultado.excluida || resultado.errores.length > 0 ? "OMITIR" : "INSERTAR";
    if (decision === "INSERTAR") resumen.filasParaInsertar++;

    return {
      numero_fila: resultado.numeroFila,
      datos_crudos: fila as Json,
      datos_normalizados: resultado.datosNormalizados as unknown as Json,
      errores: resultado.errores as unknown as Json,
      advertencias: resultado.advertencias as unknown as Json,
      decision,
    };
  });

  // storage_key/hash_sha256 son NOT NULL y hash_sha256 es único: no hay
  // archivo real, así que se usa un identificador aleatorio como relleno
  // (nunca choca con el hash de un archivo subido de verdad).
  const idUnico = randomUUID();
  const { data: importacion, error: errorImportacion } = await supabase
    .from("importacion")
    .insert({
      archivo: `Ingreso manual (${datos.filas.length} ODT)`,
      storage_key: `manual/${idUnico}`,
      hash_sha256: `manual-${idUnico}`,
      periodo_id: datos.periodoId,
      filas_leidas: resumen.filasLeidas,
      filas_validas: resumen.filasValidas,
      filas_con_error: resumen.filasConError,
      filas_advertencias: resumen.filasAdvertencias,
      estado: "VALIDADA",
      usuario: perfil.userId,
    })
    .select("id")
    .single();
  if (errorImportacion || !importacion) {
    return { ok: false, error: "No se pudo registrar el ingreso manual." };
  }

  const { error: errorFilas } = await supabase
    .from("importacion_fila")
    .insert(filasParaInsertarEnBD.map((f) => ({ ...f, importacion_id: importacion.id })));
  if (errorFilas) {
    return { ok: false, error: "No se pudieron guardar las filas ingresadas." };
  }

  return { ok: true, importacionId: importacion.id, resumen };
}
