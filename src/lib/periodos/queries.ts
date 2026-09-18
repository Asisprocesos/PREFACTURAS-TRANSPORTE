import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Periodo = Database["public"]["Tables"]["periodo"]["Row"];

export async function listarPeriodosAdmin(): Promise<Periodo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("periodo")
    .select("*")
    .order("fecha_inicio", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type OdtParaArchivo = Pick<
  Database["public"]["Tables"]["odt"]["Row"],
  "guia" | "placa_normalizada" | "centro_costo_final" | "valor" | "valor_final" | "fecha_creacion"
>;

// Tope de seguridad para el snapshot de archivado: un período de LAARCOURIER
// no debería superar este volumen de ODT; si lo hace, conviene paginar el
// export en vez de subir el límite a ciegas.
const TOPE_ODT_ARCHIVO = 20000;

export async function obtenerOdtPeriodoParaArchivo(periodoId: string): Promise<OdtParaArchivo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("odt")
    .select("guia, placa_normalizada, centro_costo_final, valor, valor_final, fecha_creacion")
    .eq("periodo_id", periodoId)
    .limit(TOPE_ODT_ARCHIVO);
  if (error) throw error;
  return data ?? [];
}

export async function contarNovedadesErrorAbiertas(periodoId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("novedad")
    .select("id", { count: "exact", head: true })
    .eq("periodo_id", periodoId)
    .eq("severidad", "ERROR")
    .eq("estado", "ABIERTA");
  if (error) throw error;
  return count ?? 0;
}
