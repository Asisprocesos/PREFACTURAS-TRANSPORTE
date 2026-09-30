import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ResultadoBusquedaPrefactura {
  prefacturaId: string | null;
  /** Motivo específico de por qué no hay prefactura, para no dejar al operador en un callejón sin salida con un mensaje genérico. */
  diagnostico?: string;
}

/**
 * Busca la prefactura de una placa en un período. Mira solo el vehículo
 * ACTIVO de esa placa (`deleted_at is null`) — igual que confirmar
 * importación, generar_prefacturas_periodo y la prefactura secundaria — en
 * vez de juntar también las filas eliminadas (una placa eliminada y vuelta
 * a cargar deja más de una fila con el mismo texto de placa, ver
 * vehiculo_placa_key: el índice único ignora las eliminadas). Mezclar esas
 * filas en el diagnóstico podía dar un mensaje equivocado: ej. si la fila
 * eliminada tenía transportista asignado pero la activa no, el aviso "sin
 * transportista" nunca se disparaba aunque la placa realmente lo necesitara.
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

  const { data: vehiculo } = await supabase
    .from("vehiculo")
    .select("id, transportista_id")
    .eq("placa", placaNormalizada)
    .is("deleted_at", null)
    .maybeSingle();

  if (!vehiculo) {
    return {
      prefacturaId: null,
      diagnostico: `No hay ningún vehículo activo registrado con la placa ${placaNormalizada}. Regístralo en Vehículos.`,
    };
  }

  const { data: prefactura } = await supabase
    .from("prefactura")
    .select("id")
    .eq("vehiculo_id", vehiculo.id)
    .eq("periodo_id", periodoId)
    // Solo la principal: puede haber además 0..N secundarias/ajuste (ver
    // Validación ODT / Escaneo) para la misma placa/período, y esta
    // búsqueda lleva a la prefactura oficial — las secundarias se
    // encuentran desde ahí (banner de vinculadas) o desde Prefacturas.
    .eq("es_principal", true)
    .maybeSingle();
  if (prefactura) return { prefacturaId: prefactura.id };

  if (!vehiculo.transportista_id) {
    return {
      prefacturaId: null,
      diagnostico: `El vehículo ${placaNormalizada} no tiene transportista asignado. Asígnaselo en Vehículos y vuelve a generar las prefacturas del período.`,
    };
  }

  const { count: cantidadOdt } = await supabase
    .from("odt")
    .select("id", { count: "exact", head: true })
    .eq("periodo_id", periodoId)
    .eq("vehiculo_id", vehiculo.id);

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
