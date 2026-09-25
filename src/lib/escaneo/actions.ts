"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { defaultAppConfig } from "@/config/app.config";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

export async function iniciarSesionEscaneoAction(formData: FormData) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const periodoId = String(formData.get("periodoId") ?? "");
  const placa = String(formData.get("placa") ?? "").trim();
  if (!periodoId) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sesion_escaneo")
    .insert({
      periodo_id: periodoId,
      placa: placa ? placa.toUpperCase().replace(/[-\s]/g, "") : null,
      iniciada_por: perfil.userId,
    })
    .select("id")
    .single();

  if (error || !data) return;
  redirect(`/validacion-odt/escaneo/${data.id}`);
}

export interface ResultadoEscaneo extends ResultadoAccion {
  guia?: string;
}

export async function registrarEscaneoAction(sesionId: string, guiaCruda: string): Promise<ResultadoEscaneo> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const guia = guiaCruda.trim().toUpperCase();
  const patron = new RegExp(defaultAppConfig.patrones.odt);
  if (!patron.test(guia)) {
    return { ok: false, error: `"${guia}" no cumple el formato esperado.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("escaneo_odt")
    .insert({ sesion_id: sesionId, guia_escaneada: guia, escaneado_por: perfil.userId });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `"${guia}" ya se escaneó en esta sesión.`, guia };
    }
    return { ok: false, error: "No se pudo registrar la lectura.", guia };
  }

  revalidatePath(`/validacion-odt/escaneo/${sesionId}`);
  return { ok: true, guia };
}

export async function finalizarSesionEscaneoAction(sesionId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("sesion_escaneo")
    .update({ finalizada_en: new Date().toISOString() })
    .eq("id", sesionId);
  if (error) return { ok: false, error: "No se pudo finalizar la sesión." };

  revalidatePath(`/validacion-odt/escaneo/${sesionId}`);
  return { ok: true };
}

/**
 * Borrado permanente (no lógico: sesion_escaneo no tiene deleted_at) —
 * pensado para limpiar sesiones de prueba del repositorio, no para el uso
 * normal. Solo ADMIN, mismo criterio que eliminarDocumentosPdfAction en
 * repositorio/actions.ts para otras acciones irreversibles. escaneo_odt se
 * borra solo por el "on delete cascade" de la referencia a sesion_escaneo.
 */
export async function eliminarSesionesEscaneoAction(ids: string[]): Promise<ResultadoAccion> {
  await requireRole(["ADMIN"]);
  if (ids.length === 0) return { ok: false, error: "No hay sesiones seleccionadas." };

  const supabase = await createClient();
  const { error } = await supabase.from("sesion_escaneo").delete().in("id", ids);
  if (error) return { ok: false, error: "No se pudieron eliminar las sesiones seleccionadas." };

  revalidatePath("/validacion-odt/escaneo");
  return { ok: true };
}
