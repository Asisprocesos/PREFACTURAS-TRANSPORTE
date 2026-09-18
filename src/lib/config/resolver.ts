import "server-only";

import { defaultAppConfig, appConfigSchema, type AppConfig } from "@/config/app.config";
import { createClient } from "@/lib/supabase/server";

/**
 * Combina los valores por defecto de `config/app.config.ts` con los
 * overrides guardados en la tabla `configuracion` (clave/valor jsonb).
 * Un override inválido (no pasa el schema tras el merge) se ignora y se
 * registra en consola, para no tumbar la app por una configuración mal
 * guardada desde la UI.
 */
export async function resolverConfiguracion(): Promise<AppConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("configuracion").select("clave, valor");

  if (error || !data) {
    return defaultAppConfig;
  }

  const overrides = Object.fromEntries(data.map((fila) => [fila.clave, fila.valor]));
  const combinado = deepMerge(defaultAppConfig as unknown as Record<string, unknown>, overrides);

  const resultado = appConfigSchema.safeParse(combinado);
  if (!resultado.success) {
    console.error(
      "Configuración inválida en tabla `configuracion`, usando valores por defecto",
      resultado.error.flatten(),
    );
    return defaultAppConfig;
  }
  return resultado.data;
}

function deepMerge(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const salida: Record<string, unknown> = { ...base };
  for (const [clave, valor] of Object.entries(overrides)) {
    const actual = salida[clave];
    if (
      valor &&
      typeof valor === "object" &&
      !Array.isArray(valor) &&
      actual &&
      typeof actual === "object" &&
      !Array.isArray(actual)
    ) {
      salida[clave] = deepMerge(actual as Record<string, unknown>, valor as Record<string, unknown>);
    } else {
      salida[clave] = valor;
    }
  }
  return salida;
}
