"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { tipoRutaCentroCostoSchema, type TipoRutaCentroCostoValues } from "./schema";

export async function crearTipoRutaCentroCostoAction(
  valores: TipoRutaCentroCostoValues,
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN"]);
  const parsed = tipoRutaCentroCostoSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipo_ruta_centro_costo")
    .insert({
      tipo_ruta: parsed.data.tipoRuta,
      centro_costo: parsed.data.centroCosto || null,
      requiere_revision: parsed.data.requiereRevision,
      activo: parsed.data.activo,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe ese Tipo de Ruta en el catálogo." };
    }
    return { ok: false, error: "No se pudo crear la fila del catálogo." };
  }

  revalidatePath("/configuracion");
  return { ok: true, id: data.id };
}

export async function actualizarTipoRutaCentroCostoAction(
  id: string,
  valores: TipoRutaCentroCostoValues,
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN"]);
  const parsed = tipoRutaCentroCostoSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tipo_ruta_centro_costo")
    .update({
      tipo_ruta: parsed.data.tipoRuta,
      centro_costo: parsed.data.centroCosto || null,
      requiere_revision: parsed.data.requiereRevision,
      activo: parsed.data.activo,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe otra fila con ese Tipo de Ruta." };
    }
    return { ok: false, error: "No se pudo actualizar la fila del catálogo." };
  }

  revalidatePath("/configuracion");
  return { ok: true, id };
}
