import "server-only";

import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface ResultadoAsignarConductor {
  ok: boolean;
  cambiado?: boolean;
  error?: string;
}

/**
 * Registra quién maneja el vehículo ahora mismo: cierra la asignación
 * vigente anterior (si había) y crea una nueva. Compartido entre la acción
 * manual (un vehículo a la vez, desde su ficha) y la carga masiva (para que
 * volver a subir la misma plantilla sea seguro): si el conductor vigente ya
 * tiene exactamente ese nombre, no hace nada — evita crear un `conductor` y
 * una reasignación nuevos en cada re-importación del mismo archivo.
 */
export async function asignarConductorSiCambio(
  supabase: SupabaseServerClient,
  vehiculoId: string,
  nombreCompleto: string,
): Promise<ResultadoAsignarConductor> {
  const nombre = nombreCompleto.trim();
  if (!nombre) return { ok: false, error: "El nombre del conductor es obligatorio." };

  const { data: vigente } = await supabase
    .from("vehiculo_conductor")
    .select("conductor:conductor_id(nombres)")
    .eq("vehiculo_id", vehiculoId)
    .is("vigente_hasta", null)
    .maybeSingle();

  const nombreVigente = (vigente?.conductor as unknown as { nombres: string | null } | null)?.nombres?.trim();
  if (nombreVigente && nombreVigente.toLowerCase() === nombre.toLowerCase()) {
    return { ok: true, cambiado: false };
  }

  const { data: conductor, error: errorConductor } = await supabase
    .from("conductor")
    .insert({ nombres: nombre })
    .select("id")
    .single();
  if (errorConductor || !conductor) return { ok: false, error: "No se pudo registrar el conductor." };

  const { error: errorCierre } = await supabase
    .from("vehiculo_conductor")
    .update({ vigente_hasta: new Date().toISOString().slice(0, 10) })
    .eq("vehiculo_id", vehiculoId)
    .is("vigente_hasta", null);
  if (errorCierre) return { ok: false, error: "No se pudo cerrar la asignación anterior." };

  const { error: errorAsignacion } = await supabase
    .from("vehiculo_conductor")
    .insert({ vehiculo_id: vehiculoId, conductor_id: conductor.id });
  if (errorAsignacion) return { ok: false, error: "No se pudo asignar el conductor." };

  return { ok: true, cambiado: true };
}
