import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface AlertasGlobales {
  /** Prefacturas de cualquier período en ERROR_ENVIO — para el badge de Prefacturas en el sidebar. */
  prefacturasErrorEnvio: number;
  /** Novedades ABIERTA con severidad ERROR, de cualquier período — para el badge de Control por placa. */
  novedadesError: number;
}

export async function obtenerAlertasGlobales(): Promise<AlertasGlobales> {
  const supabase = await createClient();
  const [{ count: prefacturasErrorEnvio }, { count: novedadesError }] = await Promise.all([
    supabase.from("prefactura").select("id", { count: "exact", head: true }).eq("estado", "ERROR_ENVIO"),
    supabase
      .from("novedad")
      .select("id", { count: "exact", head: true })
      .eq("estado", "ABIERTA")
      .eq("severidad", "ERROR"),
  ]);
  return {
    prefacturasErrorEnvio: prefacturasErrorEnvio ?? 0,
    novedadesError: novedadesError ?? 0,
  };
}
