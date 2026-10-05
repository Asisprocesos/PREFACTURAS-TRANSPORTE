"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { correoPruebaSchema, type CorreoPruebaValues } from "./correo-prueba-schema";

/**
 * Solo ADMIN (igual que el resto de Configuración, y reforzado por la RLS
 * de la tabla `configuracion`): este ajuste decide si los correos de las
 * prefacturas van de verdad a los transportistas o se quedan en modo
 * prueba, así que no es un parámetro cualquiera.
 */
export async function actualizarAjustesCorreoPruebaAction(
  valores: CorreoPruebaValues,
): Promise<ResultadoAccion> {
  const perfil = await requireRole(["ADMIN"]);

  const parsed = correoPruebaSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion").upsert({
    clave: "correo_prueba",
    valor: parsed.data,
    updated_by: perfil.userId,
  });
  if (error) return { ok: false, error: "No se pudo guardar la configuración de correo." };

  revalidatePath("/configuracion");
  return { ok: true };
}
