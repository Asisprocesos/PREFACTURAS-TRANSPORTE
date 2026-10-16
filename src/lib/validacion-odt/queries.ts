import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ResultadoBusquedaPrefactura {
  prefacturaId: string | null;
  /** Motivo específico de por qué no hay prefactura, para no dejar al operador en un callejón sin salida con un mensaje genérico. */
  diagnostico?: string;
}

/**
 * Busca la prefactura de una placa en un período, directo por
 * prefactura.placa_normalizada (ya no hace falta pasar por el vehículo:
 * generar_prefacturas_periodo crea la prefactura "mínima" con solo la placa
 * aunque todavía no haya vehículo/transportista registrado, ver esa
 * función). Cuando no hay prefactura, diagnostica la causa más probable en
 * vez de repetir siempre "genera las prefacturas primero".
 */
export async function buscarPrefactura(
  placa: string,
  periodoId: string,
): Promise<ResultadoBusquedaPrefactura> {
  const supabase = await createClient();
  const placaNormalizada = placa.toUpperCase().replace(/[-\s]/g, "");

  const { data: prefactura } = await supabase
    .from("prefactura")
    .select("id")
    .eq("placa_normalizada", placaNormalizada)
    .eq("periodo_id", periodoId)
    // Solo la principal: puede haber además 0..N secundarias/ajuste (ver
    // Validación ODT / Escaneo) para la misma placa/período, y esta
    // búsqueda lleva a la prefactura oficial — las secundarias se
    // encuentran desde ahí (banner de vinculadas) o desde Prefacturas.
    .eq("es_principal", true)
    .maybeSingle();
  if (prefactura) return { prefacturaId: prefactura.id };

  const { count: cantidadOdt } = await supabase
    .from("odt")
    .select("id", { count: "exact", head: true })
    .eq("periodo_id", periodoId)
    .eq("placa_normalizada", placaNormalizada);

  if (!cantidadOdt) {
    return {
      prefacturaId: null,
      diagnostico: `No hay ODT cargadas con la placa ${placaNormalizada} en este período.`,
    };
  }

  return {
    prefacturaId: null,
    diagnostico: `La placa ${placaNormalizada} tiene ${cantidadOdt} ODT en este período pero todavía no se generó su prefactura. Ve a Prefacturas y genera las prefacturas del período.`,
  };
}
