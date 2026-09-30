import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Busca la prefactura de una placa en un período. `placa` puede coincidir
 * con más de una fila de `vehiculo` (el índice único ignora las eliminadas,
 * ver vehiculo_placa_key: `where deleted_at is null` — una placa eliminada y
 * vuelta a cargar deja dos filas), así que se trae la lista completa en vez
 * de `.maybeSingle()` sobre `vehiculo` directamente, que fallaba en
 * silencio con más de una fila y hacía ver "no hay prefactura" aunque sí
 * existiera.
 */
export async function buscarPrefactura(placa: string, periodoId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: vehiculos } = await supabase
    .from("vehiculo")
    .select("id")
    .eq("placa", placa.toUpperCase().replace(/[-\s]/g, ""));
  if (!vehiculos || vehiculos.length === 0) return null;

  const { data: prefactura } = await supabase
    .from("prefactura")
    .select("id")
    .in(
      "vehiculo_id",
      vehiculos.map((v) => v.id),
    )
    .eq("periodo_id", periodoId)
    .maybeSingle();

  return prefactura?.id ?? null;
}
