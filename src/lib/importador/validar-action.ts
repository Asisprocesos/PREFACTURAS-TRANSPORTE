"use server";

import * as XLSX from "xlsx";

import { defaultAppConfig } from "@/config/app.config";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { DecisionFila, Json } from "@/types/database.types";

import { camposObligatoriosFaltantes, ETIQUETA_CAMPO, type CampoOdt } from "./campos";
import { aplicarMapeo } from "./mapeo";
import { validarFila, type ContextoValidacion } from "./validar";

export interface ResumenValidacion {
  filasLeidas: number;
  filasValidas: number;
  filasConError: number;
  filasAdvertencias: number;
  filasExcluidas: number;
  /** Filas con decision = INSERTAR ahora mismo: las que confirmar_importacion insertará. */
  filasParaInsertar: number;
}

const TAMANO_LOTE_INSERT = 500;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Parte del contexto de validación que no depende del lote de filas que se
 * está procesando (catálogos + rango del período). `guiasExistentesBD` se
 * arma aparte porque depende de qué guías se están validando: el lote
 * completo en `validarImportacionAction`, o una sola en la revalidación de
 * `corregirFilaImportacionAction`.
 */
export async function construirContextoBase(
  supabase: SupabaseServerClient,
  periodoId: string,
): Promise<Omit<ContextoValidacion, "guiasExistentesBD">> {
  const { data: periodo, error: errorPeriodo } = await supabase
    .from("periodo")
    .select("id, fecha_inicio, fecha_fin")
    .eq("id", periodoId)
    .single();
  if (errorPeriodo || !periodo) throw new Error("El período seleccionado no existe.");

  const [{ data: vehiculos }, { data: tiposRuta }] = await Promise.all([
    supabase.from("vehiculo").select("placa").is("deleted_at", null),
    supabase
      .from("tipo_ruta_centro_costo")
      .select("tipo_ruta, centro_costo, requiere_revision")
      .is("deleted_at", null)
      .eq("activo", true),
  ]);

  const placasConocidas = new Set((vehiculos ?? []).map((v) => v.placa));
  const tiposRutaMapa = new Map(
    (tiposRuta ?? []).map((t) => [
      t.tipo_ruta.toUpperCase(),
      { requiereRevision: t.requiere_revision, centroCosto: t.centro_costo },
    ]),
  );

  return {
    periodoInicio: new Date(`${periodo.fecha_inicio}T00:00:00Z`),
    periodoFin: new Date(`${periodo.fecha_fin}T00:00:00Z`),
    placasConocidas,
    tiposRuta: tiposRutaMapa,
    patronPlaca: defaultAppConfig.patrones.placa,
    patronExtraccionChofer: defaultAppConfig.patrones.extraccionPlacaDesdeChofer,
  };
}

export async function validarImportacionAction(datos: {
  importacionId: string;
  periodoId: string;
  hoja: string;
  mapeo: Record<string, CampoOdt | null>;
}): Promise<ResumenValidacion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  // "estado" es obligatorio porque es la columna que decide qué se importa:
  // sin mapearla, ninguna fila tendría "Entregado" y quedarían todas
  // excluidas en silencio (seguro, pero confuso). Se bloquea acá en vez de
  // dejar que el usuario se pregunte por qué no se insertó nada. Repite el
  // chequeo del cliente (importar-wizard.tsx) porque un Server Action es la
  // frontera real de validación, no la UI.
  const faltantes = camposObligatoriosFaltantes(datos.mapeo);
  if (faltantes.length > 0) {
    throw new Error(
      `Falta mapear columnas obligatorias: ${faltantes.map((c) => ETIQUETA_CAMPO[c]).join(", ")}.`,
    );
  }

  const supabase = await createClient();

  const { data: importacion, error: errorImportacion } = await supabase
    .from("importacion")
    .select("id, storage_key")
    .eq("id", datos.importacionId)
    .single();
  if (errorImportacion || !importacion) throw new Error("Importación no encontrada.");

  // 1. Descargar el archivo (server-side) y parsear la hoja elegida.
  const { data: archivoBlob, error: errorDescarga } = await supabase.storage
    .from("imports")
    .download(importacion.storage_key);
  if (errorDescarga || !archivoBlob) throw new Error("No se pudo descargar el archivo desde Storage.");

  const buffer = await archivoBlob.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const hoja = workbook.Sheets[datos.hoja];
  if (!hoja) throw new Error(`La hoja "${datos.hoja}" no existe en el archivo.`);

  const todasLasFilas: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" });
  const filaEncabezado = detectarFilaEncabezado(todasLasFilas);
  const encabezados = (todasLasFilas[filaEncabezado] ?? []).map((h) => String(h ?? "").trim());
  const cuerpo = todasLasFilas
    .slice(filaEncabezado + 1)
    .filter((f) => f.some((c) => String(c ?? "").trim() !== ""));

  const filasCrudas = cuerpo.map((fila) => {
    const obj: Record<string, unknown> = {};
    encabezados.forEach((h, i) => (obj[h] = fila[i]));
    return obj;
  });

  // 2. Construir el contexto de validación (catálogos + placas conocidas).
  const guiasEnArchivo = new Set<string>();
  for (const fila of filasCrudas) {
    const mapeada = aplicarMapeo(fila, datos.mapeo);
    if (mapeada.guia) guiasEnArchivo.add(mapeada.guia.trim().toUpperCase());
  }

  const [contextoBase, { data: guiasExistentes }] = await Promise.all([
    construirContextoBase(supabase, datos.periodoId),
    guiasEnArchivo.size > 0
      ? supabase
          .from("odt")
          .select("guia")
          .in("guia", [...guiasEnArchivo])
      : Promise.resolve({ data: [] as { guia: string }[] }),
  ]);

  const guiasExistentesBD = new Set((guiasExistentes ?? []).map((g) => g.guia.toUpperCase()));

  const contexto: ContextoValidacion = { ...contextoBase, guiasExistentesBD };

  // 3. Validar fila por fila y preparar el staging.
  const guiasVistasEnArchivo = new Set<string>();
  const resumen: ResumenValidacion = {
    filasLeidas: filasCrudas.length,
    filasValidas: 0,
    filasConError: 0,
    filasAdvertencias: 0,
    filasExcluidas: 0,
    filasParaInsertar: 0,
  };

  const filasParaInsertarEnBD = filasCrudas.map((filaCruda, i) => {
    const mapeada = aplicarMapeo(filaCruda, datos.mapeo);
    const resultado = validarFila(i + 1, mapeada, contexto, guiasVistasEnArchivo);

    if (resultado.excluida) resumen.filasExcluidas++;
    else if (resultado.errores.length > 0) resumen.filasConError++;
    else if (resultado.advertencias.length > 0) resumen.filasAdvertencias++;
    else resumen.filasValidas++;

    // Las filas con error arrancan en OMITIR (en vez de sin decidir) para
    // que se vean de una vez como "Omitida" y no haya que marcarlas una por
    // una solo para que quede claro que no se van a insertar — el operador
    // solo tiene que actuar sobre las que sí quiere corregir e incluir.
    const decision: DecisionFila = resultado.excluida || resultado.errores.length > 0 ? "OMITIR" : "INSERTAR";
    if (decision === "INSERTAR") resumen.filasParaInsertar++;

    return {
      importacion_id: datos.importacionId,
      numero_fila: resultado.numeroFila,
      datos_crudos: filaCruda as Json,
      datos_normalizados: resultado.datosNormalizados as unknown as Json,
      errores: resultado.errores as unknown as Json,
      advertencias: resultado.advertencias as unknown as Json,
      decision,
    };
  });

  // 4. Reemplazar el staging previo (revalidación) e insertar por lotes.
  await supabase.from("importacion_fila").delete().eq("importacion_id", datos.importacionId);
  for (let i = 0; i < filasParaInsertarEnBD.length; i += TAMANO_LOTE_INSERT) {
    const lote = filasParaInsertarEnBD.slice(i, i + TAMANO_LOTE_INSERT);
    const { error } = await supabase.from("importacion_fila").insert(lote);
    if (error) throw new Error(`Error guardando el staging (lote ${i}): ${error.message}`);
  }

  await supabase
    .from("importacion")
    .update({
      periodo_id: datos.periodoId,
      hoja: datos.hoja,
      filas_leidas: resumen.filasLeidas,
      filas_validas: resumen.filasValidas,
      filas_con_error: resumen.filasConError,
      filas_advertencias: resumen.filasAdvertencias,
      estado: "VALIDADA",
    })
    .eq("id", datos.importacionId);

  return resumen;
}

function detectarFilaEncabezado(filas: unknown[][]): number {
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const fila = filas[i] ?? [];
    const noVacias = fila.filter((c) => c !== undefined && c !== null && String(c).trim() !== "");
    if (noVacias.length >= 3) {
      const siguiente = filas[i + 1] ?? [];
      if (siguiente.some((c) => c !== undefined && c !== null && String(c).trim() !== "")) return i;
    }
  }
  return 0;
}
