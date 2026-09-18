"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

export async function resolverNovedadAction(
  novedadId: string,
  resolucion: string,
  marcarComo: "RESUELTA" | "IGNORADA" = "RESUELTA",
): Promise<ResultadoAccion> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("novedad")
    .update({ estado: marcarComo, resolucion, resuelta_por: perfil.userId })
    .eq("id", novedadId);

  if (error) return { ok: false, error: "No se pudo actualizar la novedad." };

  revalidatePath("/control-placa");
  return { ok: true };
}
