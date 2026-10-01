import "server-only";

import * as XLSX from "xlsx";

import { createClient } from "@/lib/supabase/server";

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

/**
 * Descarga el archivo de una importación desde Storage y devuelve sus filas
 * de datos (sin la fila de encabezado) como objetos keyed por encabezado.
 * Compartido entre validarImportacionAction y detectarOCrearPeriodoAction:
 * ambos necesitan leer el mismo archivo/hoja antes de tener el staging en
 * `importacion_fila`.
 */
export async function leerFilasCrudasImportacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storageKey: string,
  hoja: string,
  /** Fila de encabezado ya elegida en el asistente (ver selector manual en el paso "Mapear"); si no se pasa, se detecta automáticamente. */
  filaEncabezadoManual?: number,
): Promise<Record<string, unknown>[]> {
  const { data: archivoBlob, error: errorDescarga } = await supabase.storage
    .from("imports")
    .download(storageKey);
  if (errorDescarga || !archivoBlob) throw new Error("No se pudo descargar el archivo desde Storage.");

  const buffer = await archivoBlob.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const hojaData = workbook.Sheets[hoja];
  if (!hojaData) throw new Error(`La hoja "${hoja}" no existe en el archivo.`);

  const todasLasFilas: unknown[][] = XLSX.utils.sheet_to_json(hojaData, {
    header: 1,
    raw: false,
    defval: "",
  });
  const filaEncabezado = filaEncabezadoManual ?? detectarFilaEncabezado(todasLasFilas);
  const encabezados = (todasLasFilas[filaEncabezado] ?? []).map((h) => String(h ?? "").trim());
  const cuerpo = todasLasFilas
    .slice(filaEncabezado + 1)
    .filter((f) => f.some((c) => String(c ?? "").trim() !== ""));

  return cuerpo.map((fila) => {
    const obj: Record<string, unknown> = {};
    encabezados.forEach((h, i) => (obj[h] = fila[i]));
    return obj;
  });
}
