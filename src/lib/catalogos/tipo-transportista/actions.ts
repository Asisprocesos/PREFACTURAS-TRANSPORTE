"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { tipoTransportistaSchema, type TipoTransportistaValues } from "./schema";

/** Alta/edición solo ADMIN desde Configuración, según pidió el usuario — nunca desde el formulario de Transportista. */
export async function crearTipoTransportistaAction(
  valores: TipoTransportistaValues,
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN"]);
  const parsed = tipoTransportistaSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipo_transportista")
    .insert({ nombre: parsed.data.nombre, activo: parsed.data.activo })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe ese Tipo de Transportista en el catálogo." };
    }
    return { ok: false, error: "No se pudo crear el tipo de transportista." };
  }

  revalidatePath("/configuracion");
  revalidatePath("/transportistas/nuevo");
  revalidatePath("/transportistas/[id]", "page");
  return { ok: true, id: data.id };
}

export async function actualizarTipoTransportistaAction(
  id: string,
  valores: TipoTransportistaValues,
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN"]);
  const parsed = tipoTransportistaSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tipo_transportista")
    .update({ nombre: parsed.data.nombre, activo: parsed.data.activo })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe otro Tipo de Transportista con ese nombre." };
    }
    return { ok: false, error: "No se pudo actualizar el tipo de transportista." };
  }

  revalidatePath("/configuracion");
  revalidatePath("/transportistas/nuevo");
  revalidatePath("/transportistas/[id]", "page");
  return { ok: true, id };
}
