import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface AjustesCorreoPrueba {
  modoPrueba: boolean;
  /** Tal cual se guarda/muestra: uno o varios correos separados por coma. */
  destinatarioPrueba: string;
  destinatarioFallback: string;
}

const CLAVE = "correo_prueba";

/**
 * Ajustes del modo prueba de correo, editables desde Configuración (ver
 * correo-prueba-form.tsx) sin necesidad de redesplegar. Se guardan en la
 * tabla `configuracion` (clave "correo_prueba"), separados del resto de
 * `config/app.config.ts` porque gobiernan a dónde se envían correos reales
 * — no es una plantilla ni un parámetro de negocio, es más sensible.
 *
 * Si el ADMIN nunca los guardó desde la UI, cada campo cae a su variable de
 * entorno de Vercel (EMAIL_TEST_MODE / EMAIL_TEST_RECIPIENT /
 * EMAIL_FALLBACK_RECIPIENT) — comportamiento histórico, para no romper nada
 * hasta el primer guardado desde Configuración.
 */
export async function obtenerAjustesCorreoPrueba(): Promise<AjustesCorreoPrueba> {
  const supabase = await createClient();
  const { data } = await supabase.from("configuracion").select("valor").eq("clave", CLAVE).maybeSingle();
  const guardado = (data?.valor ?? {}) as Partial<AjustesCorreoPrueba>;

  return {
    modoPrueba: guardado.modoPrueba ?? process.env.EMAIL_TEST_MODE !== "false",
    destinatarioPrueba: guardado.destinatarioPrueba ?? process.env.EMAIL_TEST_RECIPIENT ?? "",
    destinatarioFallback: guardado.destinatarioFallback ?? process.env.EMAIL_FALLBACK_RECIPIENT ?? "",
  };
}

/** "a@x.com, b@y.com" -> ["a@x.com", "b@y.com"] (usado tanto al guardar el form como al enviar). */
export function separarCorreos(valor: string): string[] {
  return valor
    .split(",")
    .map((correo) => correo.trim())
    .filter(Boolean);
}
