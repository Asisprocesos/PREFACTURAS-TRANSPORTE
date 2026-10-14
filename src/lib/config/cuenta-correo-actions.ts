"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { obtenerEstadoEnvioDiario, type EstadoEnvioDiario } from "./cuenta-correo";
import { cuentaCorreoSchema, type CuentaCorreoValues } from "./cuenta-correo-schema";

/**
 * Solo ADMIN (igual que correo-prueba-actions.ts): decide con qué cuenta de
 * Gmail se envían los correos reales de ahora en adelante.
 */
export async function actualizarCuentaCorreoAction(valores: CuentaCorreoValues): Promise<ResultadoAccion> {
  const perfil = await requireRole(["ADMIN"]);

  const parsed = cuentaCorreoSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion").upsert({
    clave: "cuenta_correo",
    valor: parsed.data,
    updated_by: perfil.userId,
  });
  if (error) return { ok: false, error: "No se pudo guardar la configuración de la cuenta de correo." };

  revalidatePath("/configuracion");
  revalidatePath("/prefacturas");
  return { ok: true };
}

/** Para el contador visual: Configuración y la pantalla de envío masivo (progreso-lote.tsx). */
export async function obtenerEstadoEnvioDiarioAction(): Promise<EstadoEnvioDiario> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  return obtenerEstadoEnvioDiario();
}
