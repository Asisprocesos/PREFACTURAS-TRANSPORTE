import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ResultadoBusquedaPrefactura {
  prefacturaId: string | null;
  /** Motivo específico de por qué no hay prefactura, para no dejar al operador en un callejón sin salida con un mensaje genérico. */
  diagnostico?: string;
}

/**
 * Busca la prefactura de una placa en un período. `placa` puede coincidir
 * con más de una fila de `vehiculo` (el índice único ignora las eliminadas,
 * ver vehiculo_placa_key: `where deleted_at is null` — una placa eliminada y
 * vuelta a cargar deja dos filas), así que se trae la lista completa en vez
 * de `.maybeSingle()` sobre `vehiculo` directamente, que fallaba en
 * silencio con más de una fila y hacía ver "no hay prefactura" aunque sí
 * existiera.
 *
 * Cuando no hay prefactura, diagnostica la causa más probable en vez de
 * repetir siempre "genera las prefacturas primero" — ese mensaje era
 * engañoso cuando la causa real era otra (placa no registrada, vehículo sin
 * transportista, o ODT que quedaron sin vehiculo_id por haberse importado
 * antes de registrar la placa; esto último ahora se corrige solo la
 * próxima vez que se generen las prefacturas del período, ver
 * generar_prefacturas_periodo).
 */
export async function buscarPrefactura(
  placa: string,
  periodoId: string,
): Promise<ResultadoBusquedaPrefactura> {
  const supabase = await createClient();
  const placaNormalizada = placa.toUpperCase().replace(/[-\s]/g, "");

  const { data: vehiculos } = await supabase
    .from("vehiculo")
    .select("id, transportista_id")
    .eq("placa", placaNormalizada);

  if (!vehiculos || vehiculos.length === 0) {
    return {
      prefacturaId: null,
      diagnostico: `No hay ningún vehículo registrado con la placa ${placaNormalizada}. Regístralo en Vehículos.`,
    };
  }

  const vehiculoIds = vehiculos.map((v) => v.id);
  const { data: prefactura } = await supabase
    .from("prefactura")
    .select("id")
    .in("vehiculo_id", vehiculoIds)
    .eq("periodo_id", periodoId)
    .maybeSingle();
  if (prefactura) return { prefacturaId: prefactura.id };

  if (vehiculos.every((v) => !v.transportista_id)) {
    return {
      prefacturaId: null,
      diagnostico: `El vehículo ${placaNormalizada} no tiene transportista asignado. Asígnaselo en Vehículos y vuelve a generar las prefacturas del período.`,
    };
  }

  const { count: cantidadOdt } = await supabase
    .from("odt")
    .select("id", { count: "exact", head: true })
    .eq("periodo_id", periodoId)
    .in("vehiculo_id", vehiculoIds);

  if (!cantidadOdt) {
    return {
      prefacturaId: null,
      diagnostico: `El vehículo ${placaNormalizada} no tiene ODT cargadas en este período.`,
    };
  }

  return {
    prefacturaId: null,
    diagnostico: `El vehículo ${placaNormalizada} tiene ${cantidadOdt} ODT en este período pero todavía no se generó su prefactura. Ve a Prefacturas y genera las prefacturas del período.`,
  };
}
