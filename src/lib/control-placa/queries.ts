import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface FilaControlPlaca {
  placa: string;
  prefacturaId: string | null;
  numero: string | null;
  total: number | null;
  cantidadOdt: number | null;
  estadoPrefactura: string | null;
  novedadesError: number;
  novedadesAdvertencia: number;
}

/**
 * Pantalla "Control por placa": une, por placa, la prefactura del período
 * (si ya se generó) con el conteo de novedades abiertas por severidad. Se
 * combina en el servidor porque involucra 3 tablas con distinta llave de
 * agrupación (odt.placa_normalizada, prefactura.vehiculo_id, novedad.placa).
 */
export async function obtenerControlPlaca(periodoId: string): Promise<FilaControlPlaca[]> {
  const supabase = await createClient();

  const [{ data: odts }, { data: prefacturas }, { data: novedades }] = await Promise.all([
    supabase
      .from("odt")
      .select("placa_normalizada")
      .eq("periodo_id", periodoId)
      .not("placa_normalizada", "is", null),
    supabase
      .from("prefactura")
      .select("id, numero, total, cantidad_odt, estado, vehiculo:vehiculo_id(placa)")
      .eq("periodo_id", periodoId),
    supabase.from("novedad").select("placa, severidad").eq("periodo_id", periodoId).eq("estado", "ABIERTA"),
  ]);

  const placas = new Set((odts ?? []).map((o) => o.placa_normalizada as string));

  const prefacturaPorPlaca = new Map<
    string,
    { id: string; numero: string | null; total: number; cantidadOdt: number; estado: string }
  >();
  for (const p of (prefacturas ?? []) as unknown as {
    id: string;
    numero: string | null;
    total: number;
    cantidad_odt: number;
    estado: string;
    vehiculo: { placa: string } | null;
  }[]) {
    if (!p.vehiculo?.placa) continue;
    prefacturaPorPlaca.set(p.vehiculo.placa, {
      id: p.id,
      numero: p.numero,
      total: p.total,
      cantidadOdt: p.cantidad_odt,
      estado: p.estado,
    });
    placas.add(p.vehiculo.placa);
  }

  const novedadesPorPlaca = new Map<string, { error: number; advertencia: number }>();
  for (const n of novedades ?? []) {
    if (!n.placa) continue;
    const actual = novedadesPorPlaca.get(n.placa) ?? { error: 0, advertencia: 0 };
    if (n.severidad === "ERROR") actual.error++;
    else if (n.severidad === "ADVERTENCIA") actual.advertencia++;
    novedadesPorPlaca.set(n.placa, actual);
  }

  return [...placas].sort().map((placa) => {
    const pref = prefacturaPorPlaca.get(placa);
    const nov = novedadesPorPlaca.get(placa) ?? { error: 0, advertencia: 0 };
    return {
      placa,
      prefacturaId: pref?.id ?? null,
      numero: pref?.numero ?? null,
      total: pref?.total ?? null,
      cantidadOdt: pref?.cantidadOdt ?? null,
      estadoPrefactura: pref?.estado ?? null,
      novedadesError: nov.error,
      novedadesAdvertencia: nov.advertencia,
    };
  });
}
