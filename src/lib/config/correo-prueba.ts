import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

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
 *
 * `supabaseClient` es obligatorio pasarlo cuando quien llama no tiene sesión
 * de usuario — el worker de correo (`/api/jobs/email`, disparado por
 * pg_cron sin cookies de ningún usuario) debe pasar su cliente admin
 * (service_role). Sin esto, el cliente por defecto (cookies de sesión)
 * no tiene con qué autenticarse ahí, la política de RLS de `configuracion`
 * (exige un rol válido) no deja leer nada, y el ajuste guardado en
 * Configuración queda invisible para ese worker — cae en silencio a la
 * variable de entorno aunque el ADMIN ya lo haya cambiado desde la UI.
 */
export async function obtenerAjustesCorreoPrueba(
  supabaseClient?: SupabaseClient<Database>,
): Promise<AjustesCorreoPrueba> {
  const supabase = supabaseClient ?? (await createClient());
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
