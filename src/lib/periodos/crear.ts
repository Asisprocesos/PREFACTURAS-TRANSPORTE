import "server-only";

import { createClient } from "@/lib/supabase/server";

import { construirNombrePeriodo } from "./nombre";

export interface ResultadoCrearPeriodoConRango {
  ok: boolean;
  error?: string;
  periodoId?: string;
  periodoNombre?: string;
}

/**
 * Inserta un período con el rango dado: el número se asigna solo (siguiente
 * al mayor existente) y el nombre se arma con el mismo patrón que los ya
 * cargados (ver nombre.ts). Sin chequeo de rol — cada caller
 * (crearPeriodoAction en Configuración, detectarOCrearPeriodoAction en el
 * importador) lo hace con el alcance que le corresponde antes de llamar acá.
 */
export async function crearPeriodoConRango(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fechaInicio: string,
  fechaFin: string,
): Promise<ResultadoCrearPeriodoConRango> {
  if (fechaFin <= fechaInicio) {
    return { ok: false, error: "La fecha de fin debe ser posterior a la fecha de inicio." };
  }

  const { data: ultimo } = await supabase
    .from("periodo")
    .select("numero")
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  const numero = (ultimo?.numero ?? 0) + 1;
  const nombre = construirNombrePeriodo(numero, fechaInicio, fechaFin);

  const { data, error } = await supabase
    .from("periodo")
    .insert({ numero, nombre, fecha_inicio: fechaInicio, fecha_fin: fechaFin, estado: "ABIERTO" })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error: error.message.includes("periodo_rango_key")
        ? "Ya existe un período con ese rango de fechas."
        : "No se pudo crear el período.",
    };
  }

  return { ok: true, periodoId: data.id, periodoNombre: nombre };
}
