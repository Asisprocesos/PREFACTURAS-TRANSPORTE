"use server";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

import type { AliasMapeo } from "./mapeo";
import { listarFilasImportacion, obtenerImportacion, type ListarFilasParams } from "./queries";

export async function obtenerAliasMapeoAction(): Promise<AliasMapeo[]> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mapeo_columna")
    .select("alias_origen, campo_interno")
    .eq("plantilla", "default")
    .eq("activo", true);
  if (error) throw error;
  return data ?? [];
}

export async function guardarAliasMapeoAction(alias: AliasMapeo[]) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();
  for (const a of alias) {
    await supabase
      .from("mapeo_columna")
      .upsert(
        { plantilla: "default", alias_origen: a.alias_origen, campo_interno: a.campo_interno },
        { onConflict: "plantilla,alias_origen" },
      );
  }
}

export async function obtenerImportacionAction(id: string) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  return obtenerImportacion(id);
}

export async function listarFilasImportacionAction(params: ListarFilasParams) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  return listarFilasImportacion(params);
}
