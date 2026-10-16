import "server-only";

import { categorizarNovedad } from "@/lib/novedades/categorias";
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
  /**
   * Prefactura "mínima" (ver generar_prefacturas_periodo): qué dato de
   * catálogo falta para completarla, o null si ya está completa (o si
   * todavía no hay prefactura). No vive en la tabla `novedad` — no hay nada
   * que "Resolver" a mano, se completa sola registrando el vehículo/
   * transportista y volviendo a generar las prefacturas del período.
   */
  avisoDatosMinimos: string | null;
}

export interface FiltrosControlPlaca {
  /** Severidad requerida, o "SIN_NOVEDADES" para placas sin novedades abiertas. */
  severidad?: "ERROR" | "ADVERTENCIA" | "SIN_NOVEDADES";
  /** Id de categoría (ver src/lib/novedades/categorias.ts). Solo deja placas con ≥1 novedad de ese tipo. */
  categoria?: string;
  /** Filtra por placa o número de prefactura (substring, sin distinguir mayúsculas). */
  busqueda?: string;
}

/**
 * Pantalla "Control por placa": une, por placa, la prefactura del período
 * (si ya se generó) con el conteo de novedades abiertas por severidad. Se
 * combina en el servidor porque involucra 3 tablas con su propia columna de
 * placa (odt.placa_normalizada, prefactura.placa_normalizada, novedad.placa).
 *
 * `filtros.categoria` categoriza cada novedad por el texto de su `mensaje`
 * (ver src/lib/novedades/categorias.ts) porque `novedad.tipo` siempre vale
 * el literal 'IMPORTACION' y no distingue el tipo real de la novedad.
 */
export async function obtenerControlPlaca(
  periodoId: string,
  filtros: FiltrosControlPlaca = {},
): Promise<FilaControlPlaca[]> {
  const supabase = await createClient();

  const [{ data: odts }, { data: prefacturas }, { data: novedades }] = await Promise.all([
    supabase
      .from("odt")
      .select("placa_normalizada")
      .eq("periodo_id", periodoId)
      .not("placa_normalizada", "is", null),
    supabase
      .from("prefactura")
      .select("id, numero, total, cantidad_odt, estado, placa_normalizada, vehiculo_id, transportista_id")
      .eq("periodo_id", periodoId)
      // Solo la principal: una placa puede tener además 0..N prefacturas
      // secundarias/ajuste (ver Validación ODT / Escaneo), y este semáforo
      // muestra la prefactura "oficial" del período, no las correcciones.
      .eq("es_principal", true),
    supabase
      .from("novedad")
      .select("placa, severidad, mensaje")
      .eq("periodo_id", periodoId)
      .eq("estado", "ABIERTA"),
  ]);

  const placas = new Set((odts ?? []).map((o) => o.placa_normalizada as string));

  const prefacturaPorPlaca = new Map<
    string,
    {
      id: string;
      numero: string | null;
      total: number;
      cantidadOdt: number;
      estado: string;
      avisoDatosMinimos: string | null;
    }
  >();
  for (const p of (prefacturas ?? []) as unknown as {
    id: string;
    numero: string | null;
    total: number;
    cantidad_odt: number;
    estado: string;
    placa_normalizada: string;
    vehiculo_id: string | null;
    transportista_id: string | null;
  }[]) {
    // placa_normalizada vive directo en prefactura (ya no hace falta pasar
    // por vehiculo): así también aparecen las prefacturas "mínimas", sin
    // vehículo registrado todavía (ver generar_prefacturas_periodo).
    const avisoDatosMinimos = !p.vehiculo_id
      ? "Sin vehículo registrado"
      : !p.transportista_id
        ? "Sin transportista asignado"
        : null;
    prefacturaPorPlaca.set(p.placa_normalizada, {
      id: p.id,
      numero: p.numero,
      total: p.total,
      cantidadOdt: p.cantidad_odt,
      estado: p.estado,
      avisoDatosMinimos,
    });
    placas.add(p.placa_normalizada);
  }

  const novedadesPorPlaca = new Map<string, { error: number; advertencia: number }>();
  for (const n of novedades ?? []) {
    if (!n.placa) continue;
    if (filtros.categoria && categorizarNovedad(n.mensaje) !== filtros.categoria) continue;
    const actual = novedadesPorPlaca.get(n.placa) ?? { error: 0, advertencia: 0 };
    if (n.severidad === "ERROR") actual.error++;
    else if (n.severidad === "ADVERTENCIA") actual.advertencia++;
    novedadesPorPlaca.set(n.placa, actual);
  }

  let resultado = [...placas].sort().map((placa) => {
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
      avisoDatosMinimos: pref?.avisoDatosMinimos ?? null,
    };
  });

  const busqueda = filtros.busqueda?.trim().toUpperCase();
  if (busqueda) {
    resultado = resultado.filter(
      (f) => f.placa.includes(busqueda) || (f.numero ?? "").toUpperCase().includes(busqueda),
    );
  }

  // Con categoría activa, solo interesan las placas que tienen novedades de
  // ese tipo (el conteo ya viene filtrado por categoría desde el map de arriba).
  if (filtros.categoria) {
    resultado = resultado.filter((f) => f.novedadesError + f.novedadesAdvertencia > 0);
  }
  if (filtros.severidad === "ERROR") {
    resultado = resultado.filter((f) => f.novedadesError > 0);
  } else if (filtros.severidad === "ADVERTENCIA") {
    resultado = resultado.filter((f) => f.novedadesAdvertencia > 0 || f.avisoDatosMinimos !== null);
  } else if (filtros.severidad === "SIN_NOVEDADES") {
    resultado = resultado.filter(
      (f) => f.novedadesError + f.novedadesAdvertencia === 0 && f.avisoDatosMinimos === null,
    );
  }

  return resultado;
}

export interface PrefacturaResumenPlaca {
  id: string;
  numero: string | null;
  vehiculoId: string | null;
  avisoDatosMinimos: string | null;
}

/**
 * Para el detalle por placa (/control-placa/[placa]): mismo cálculo de
 * avisoDatosMinimos que obtenerControlPlaca, pero para una sola placa —
 * evita traer el período completo solo para mostrar el aviso en esta
 * pantalla. `vehiculoId` sirve para enlazar a "Asignar transportista" (o a
 * "Registrar vehículo" cuando es null) sin otra consulta.
 */
export async function obtenerPrefacturaResumenPlaca(
  placa: string,
  periodoId: string,
): Promise<PrefacturaResumenPlaca | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prefactura")
    .select("id, numero, vehiculo_id, transportista_id")
    .eq("placa_normalizada", placa)
    .eq("periodo_id", periodoId)
    .eq("es_principal", true)
    .maybeSingle();
  if (!data) return null;

  const avisoDatosMinimos = !data.vehiculo_id
    ? "Sin vehículo registrado"
    : !data.transportista_id
      ? "Sin transportista asignado"
      : null;
  return { id: data.id, numero: data.numero, vehiculoId: data.vehiculo_id, avisoDatosMinimos };
}
