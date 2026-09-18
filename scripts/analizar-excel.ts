#!/usr/bin/env tsx
/**
 * Analiza los archivos fuente en docs/fuentes/ y genera docs/diagnostico-excel.md.
 *
 * No asume la estructura de columnas: recorre cada hoja de cada libro,
 * detecta la fila de encabezados (puede haber filas vacías o títulos arriba),
 * infiere tipos de dato por columna, detecta celdas combinadas, subtotales,
 * encabezados repetidos dentro del cuerpo, valores vacíos, formatos de fecha
 * y caracteres ocultos típicos de exportaciones de Fénix (_x000D_, \r, \n).
 *
 * Uso:
 *   npm run analizar:excel
 *
 * Requiere que los archivos reales existan en docs/fuentes/ (ver
 * docs/fuentes/README.md). Si no existen, el script termina con un mensaje
 * explicativo sin fallar el build.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

const FUENTES_DIR = join(process.cwd(), "docs", "fuentes");
const SALIDA = join(process.cwd(), "docs", "diagnostico-excel.md");

const ARCHIVOS = ["CORTE_AL_12_DE_SEPTIEMBRE_2026.xlsx", "MACRO_CORTE_13_JUL_-_12_AGO.xlsb"] as const;

const RE_OCULTO = /(_x000d_|\r|\n)/i;

type Tipo = "texto" | "numero" | "fecha" | "vacio" | "mixto";

interface DiagnosticoColumna {
  nombre: string;
  indice: number;
  tipoDominante: Tipo;
  vacios: number;
  ocultos: number;
  ejemplos: string[];
  formatosFecha: Set<string>;
}

interface DiagnosticoHoja {
  nombre: string;
  filasTotales: number;
  filaEncabezado: number;
  columnas: DiagnosticoColumna[];
  celdasCombinadas: number;
  filasSubtotal: number[];
  encabezadosRepetidos: number[];
  filasVacias: number;
}

function detectarFilaEncabezado(filas: unknown[][]): number {
  // La fila de encabezado es la primera con >= 3 celdas de texto no vacías
  // y donde la fila siguiente tiene datos (para descartar filas de título).
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const fila = filas[i] ?? [];
    const noVacias = fila.filter((c) => c !== undefined && c !== null && String(c).trim() !== "");
    if (noVacias.length >= 3) {
      const siguiente = filas[i + 1] ?? [];
      const siguienteNoVacia = siguiente.some(
        (c) => c !== undefined && c !== null && String(c).trim() !== "",
      );
      if (siguienteNoVacia) return i;
    }
  }
  return 0;
}

function inferirTipo(valor: unknown): Tipo {
  if (valor === undefined || valor === null || String(valor).trim() === "") return "vacio";
  if (valor instanceof Date) return "fecha";
  if (typeof valor === "number") return "numero";
  const s = String(valor).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return "fecha";
  if (/^-?\d+([.,]\d+)?$/.test(s)) return "numero";
  return "texto";
}

function analizarHoja(wb: XLSX.WorkBook, nombreHoja: string): DiagnosticoHoja {
  const hoja = wb.Sheets[nombreHoja];
  if (!hoja) {
    throw new Error(`La hoja "${nombreHoja}" no existe en el libro.`);
  }
  const filas: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" });
  const filaEncabezado = detectarFilaEncabezado(filas);
  const encabezados = (filas[filaEncabezado] ?? []).map((h) => String(h ?? "").trim());
  const cuerpo = filas.slice(filaEncabezado + 1);

  const columnas: DiagnosticoColumna[] = encabezados.map((nombre, indice) => {
    const valores = cuerpo.map((fila) => fila[indice]);
    const tipos = valores.map(inferirTipo);
    const tiposNoVacios = tipos.filter((t) => t !== "vacio");
    const distintos = [...new Set(tiposNoVacios)];
    const tipoDominante: Tipo =
      distintos.length === 0 ? "vacio" : distintos.length === 1 ? distintos[0]! : "mixto";
    const vacios = tipos.filter((t) => t === "vacio").length;
    const ocultos = valores.filter((v) => typeof v === "string" && RE_OCULTO.test(v)).length;
    const formatosFecha = new Set<string>();
    for (const v of valores) {
      if (typeof v === "string" && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v.trim())) {
        formatosFecha.add("dd/mm/aaaa (texto)");
      } else if (v instanceof Date) {
        formatosFecha.add("fecha nativa (serial Excel)");
      }
    }
    const ejemplos = [...new Set(valores.map((v) => String(v ?? "").trim()).filter((v) => v !== ""))].slice(
      0,
      3,
    );
    return { nombre, indice, tipoDominante, vacios, ocultos, ejemplos, formatosFecha };
  });

  const filasSubtotal = cuerpo
    .map((fila, i) => (fila.some((c) => /total/i.test(String(c ?? ""))) ? i : -1))
    .filter((i) => i >= 0);

  const encabezadosRepetidos = cuerpo
    .map((fila, i) => {
      const coincide = encabezados.filter((h, idx) => h && String(fila[idx] ?? "").trim() === h).length;
      return coincide >= Math.max(2, Math.floor(encabezados.length * 0.5)) ? i : -1;
    })
    .filter((i) => i >= 0);

  const filasVacias = cuerpo.filter((fila) => fila.every((c) => String(c ?? "").trim() === "")).length;

  return {
    nombre: nombreHoja,
    filasTotales: cuerpo.length,
    filaEncabezado,
    columnas,
    celdasCombinadas: hoja["!merges"]?.length ?? 0,
    filasSubtotal,
    encabezadosRepetidos,
    filasVacias,
  };
}

function renderHoja(h: DiagnosticoHoja): string {
  const lineas: string[] = [];
  lineas.push(`### Hoja \`${h.nombre}\``);
  lineas.push("");
  lineas.push(`- Fila de encabezado detectada: ${h.filaEncabezado + 1}`);
  lineas.push(`- Filas de datos: ${h.filasTotales}`);
  lineas.push(`- Celdas combinadas: ${h.celdasCombinadas}`);
  lineas.push(`- Filas vacías: ${h.filasVacias}`);
  lineas.push(
    `- Filas que parecen subtotal/total: ${h.filasSubtotal.length ? h.filasSubtotal.join(", ") : "ninguna"}`,
  );
  lineas.push(
    `- Filas con encabezados repetidos en el cuerpo: ${h.encabezadosRepetidos.length ? h.encabezadosRepetidos.join(", ") : "ninguna"}`,
  );
  lineas.push("");
  lineas.push(
    "| # | Columna | Tipo dominante | Vacíos | Con `_x000D_`/`\\r`/`\\n` | Formatos de fecha | Ejemplos |",
  );
  lineas.push("|---|---|---|---|---|---|---|");
  for (const c of h.columnas) {
    lineas.push(
      `| ${c.indice + 1} | ${c.nombre || "(sin nombre)"} | ${c.tipoDominante} | ${c.vacios} | ${c.ocultos} | ${[...c.formatosFecha].join(", ") || "-"} | ${c.ejemplos.map((e) => "`" + e + "`").join(", ")} |`,
    );
  }
  lineas.push("");
  return lineas.join("\n");
}

function main() {
  const disponibles = ARCHIVOS.filter((a) => existsSync(join(FUENTES_DIR, a)));
  if (disponibles.length === 0) {
    console.log(
      "No se encontraron archivos fuente en docs/fuentes/. " +
        "Este script no sobrescribe docs/diagnostico-excel.md porque no hay nada que analizar. " +
        "Ver docs/fuentes/README.md.",
    );
    return;
  }

  const secciones: string[] = [];
  secciones.push("# Diagnóstico de archivos Excel (generado por scripts/analizar-excel.ts)");
  secciones.push("");
  secciones.push(`Generado: ${new Date().toISOString()}`);
  secciones.push("");

  for (const archivo of disponibles) {
    const ruta = join(FUENTES_DIR, archivo);
    console.log(`Analizando ${archivo}...`);
    const buf = readFileSync(ruta);
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    secciones.push(`## Archivo \`${archivo}\``);
    secciones.push("");
    secciones.push(`Hojas: ${wb.SheetNames.join(", ")}`);
    secciones.push("");
    for (const nombreHoja of wb.SheetNames) {
      const diag = analizarHoja(wb, nombreHoja);
      secciones.push(renderHoja(diag));
    }
  }

  writeFileSync(SALIDA, secciones.join("\n"), "utf-8");
  console.log(`Diagnóstico escrito en ${SALIDA}`);
}

main();
