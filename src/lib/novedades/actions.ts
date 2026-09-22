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

  // "/control-placa" solo revalida esa página exacta; sin también apuntar al
  // patrón dinámico, el detalle por placa (de donde sale esta acción) y la
  // tarjeta de novedades de la prefactura podían seguir mostrando la
  // novedad como abierta desde el Router Cache del cliente.
  revalidatePath("/control-placa");
  revalidatePath("/control-placa/[placa]", "page");
  revalidatePath("/prefacturas/[id]", "page");
  return { ok: true };
}
