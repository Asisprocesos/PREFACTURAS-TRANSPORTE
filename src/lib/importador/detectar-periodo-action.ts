"use server";

import { requireRole } from "@/lib/auth/roles";
import { crearPeriodoConRango } from "@/lib/periodos/crear";
import { createClient } from "@/lib/supabase/server";
import { calcularRangoPeriodo } from "@/lib/validation/periodo";
import { parsearFechaDdMmAaaa } from "@/lib/validation/texto";

import { leerFilasCrudasImportacion } from "./leer-archivo";

export interface ResultadoDeteccionPeriodo {
  ok: boolean;
  error?: string;
  periodoId?: string;
  periodoNombre?: string;
  creado?: boolean;
  filasEnVentana?: number;
  filasFueraDeVentana?: number;
}

function formatoFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Detecta el período 13→12 (ver calcularRangoPeriodo) al que corresponde la
 * mayoría de filas del archivo, según su columna de Fecha Creación, y lo
 * selecciona; si no existe todavía, lo crea. Las filas con fecha en otra
 * ventana no se bloquean acá — quedan marcadas como advertencia al validar
 * (ver validarFila / fechaEnRango), igual que si el período se hubiera
 * elegido a mano.
 */
export async function detectarOCrearPeriodoAction(datos: {
  importacionId: string;
  hoja: string;
  columnaFecha: string;
}): Promise<ResultadoDeteccionPeriodo> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const supabase = await createClient();
  const { data: importacion, error: errorImportacion } = await supabase
    .from("importacion")
    .select("id, storage_key")
    .eq("id", datos.importacionId)
    .single();
  if (errorImportacion || !importacion) return { ok: false, error: "Importación no encontrada." };

  let filasCrudas: Record<string, unknown>[];
  try {
    filasCrudas = await leerFilasCrudasImportacion(supabase, importacion.storage_key, datos.hoja);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }

  const conteoPorVentana = new Map<string, { fechaInicio: string; fechaFin: string; cantidad: number }>();
  for (const filaCruda of filasCrudas) {
    const valor = filaCruda[datos.columnaFecha];
    const fecha = valor ? parsearFechaDdMmAaaa(String(valor).trim()) : null;
    if (!fecha) continue;

    const { inicio, fin } = calcularRangoPeriodo(fecha);
    const fechaInicio = formatoFecha(inicio);
    const fechaFin = formatoFecha(fin);
    const clave = `${fechaInicio}_${fechaFin}`;
    const actual = conteoPorVentana.get(clave) ?? { fechaInicio, fechaFin, cantidad: 0 };
    actual.cantidad++;
    conteoPorVentana.set(clave, actual);
  }

  if (conteoPorVentana.size === 0) {
    return { ok: false, error: "No se pudo leer ninguna Fecha Creación válida en el archivo." };
  }

  const ventanas = [...conteoPorVentana.values()].sort((a, b) => b.cantidad - a.cantidad);
  const ganadora = ventanas[0]!;
  const totalFilas = ventanas.reduce((acc, v) => acc + v.cantidad, 0);
  const filasFueraDeVentana = totalFilas - ganadora.cantidad;

  const { data: existente } = await supabase
    .from("periodo")
    .select("id, nombre")
    .eq("fecha_inicio", ganadora.fechaInicio)
    .eq("fecha_fin", ganadora.fechaFin)
    .maybeSingle();

  if (existente) {
    return {
      ok: true,
      periodoId: existente.id,
      periodoNombre: existente.nombre,
      creado: false,
      filasEnVentana: ganadora.cantidad,
      filasFueraDeVentana,
    };
  }

  const creado = await crearPeriodoConRango(supabase, ganadora.fechaInicio, ganadora.fechaFin);
  if (!creado.ok || !creado.periodoId) return { ok: false, error: creado.error };

  return {
    ok: true,
    periodoId: creado.periodoId,
    periodoNombre: creado.periodoNombre,
    creado: true,
    filasEnVentana: ganadora.cantidad,
    filasFueraDeVentana,
  };
}
