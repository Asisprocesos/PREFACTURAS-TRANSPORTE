/// <reference lib="webworker" />
import * as XLSX from "xlsx";

/**
 * Web Worker: parsea el Excel/CSV del corte en el navegador para la vista
 * previa (pasos "Leer"/"Mapear" del importador), sin bloquear la UI. La
 * validación real y la inserción ocurren en el servidor sobre el mismo
 * archivo ya subido a Storage — este worker nunca escribe en la base de
 * datos, solo alimenta la previsualización.
 */

export type MensajeEntrada =
  | { tipo: "analizar"; archivo: File }
  | { tipo: "previsualizar"; hoja: string; filas?: number };

export type MensajeSalida =
  | { tipo: "hojas"; hojas: { nombre: string; filas: number }[] }
  | { tipo: "previsualizacion"; hoja: string; filaEncabezado: number; encabezados: string[]; filas: unknown[][] }
  | { tipo: "error"; mensaje: string };

let libroActual: XLSX.WorkBook | null = null;

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

self.onmessage = async (event: MessageEvent<MensajeEntrada>) => {
  const mensaje = event.data;

  try {
    if (mensaje.tipo === "analizar") {
      const buffer = await mensaje.archivo.arrayBuffer();
      libroActual = XLSX.read(buffer, { type: "array", cellDates: true });

      const hojas = libroActual.SheetNames.map((nombre) => {
        const hoja = libroActual!.Sheets[nombre];
        const filas: unknown[][] = hoja ? XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" }) : [];
        return { nombre, filas: Math.max(0, filas.length - 1) };
      });

      const respuesta: MensajeSalida = { tipo: "hojas", hojas };
      self.postMessage(respuesta);
      return;
    }

    if (mensaje.tipo === "previsualizar") {
      if (!libroActual) throw new Error("Primero analiza el archivo.");
      const hoja = libroActual.Sheets[mensaje.hoja];
      if (!hoja) throw new Error(`La hoja "${mensaje.hoja}" no existe.`);

      const todasLasFilas: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" });
      const filaEncabezado = detectarFilaEncabezado(todasLasFilas);
      const encabezados = (todasLasFilas[filaEncabezado] ?? []).map((h) => String(h ?? "").trim());
      const limite = mensaje.filas ?? 50;
      const filas = todasLasFilas.slice(filaEncabezado + 1, filaEncabezado + 1 + limite);

      const respuesta: MensajeSalida = { tipo: "previsualizacion", hoja: mensaje.hoja, filaEncabezado, encabezados, filas };
      self.postMessage(respuesta);
      return;
    }
  } catch (err) {
    const respuesta: MensajeSalida = { tipo: "error", mensaje: err instanceof Error ? err.message : "Error desconocido." };
    self.postMessage(respuesta);
  }
};
