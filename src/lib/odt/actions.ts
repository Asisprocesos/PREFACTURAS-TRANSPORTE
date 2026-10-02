"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";
import type { Database } from "@/types/database.types";

type OdtUpdate = Database["public"]["Tables"]["odt"]["Update"];

const CAMPOS_CORREGIBLES = [
  "placa_normalizada",
  "fecha_creacion",
  "valor_final",
  "tipo_ruta",
  "centro_costo_final",
  "regional_origen_texto",
] as const;
type CampoCorregible = (typeof CAMPOS_CORREGIBLES)[number];

function esCampoCorregible(campo: string): campo is CampoCorregible {
  return (CAMPOS_CORREGIBLES as readonly string[]).includes(campo);
}

/** Campos que deben quedar siempre en mayúsculas para uniformidad (ver también validarFila, vehiculoFormSchema y tipoRutaCentroCostoSchema). */
const CAMPOS_MAYUSCULAS = new Set<CampoCorregible>(["placa_normalizada", "tipo_ruta", "centro_costo_final"]);

/**
 * Marca REQUIERE_REGENERAR las prefacturas con PDF vigente que incluyen esta
 * ODT, y devuelve los ids de TODAS las prefacturas afectadas (tengan o no
 * PDF vigente) para poder revalidar sus páginas de detalle.
 */
export async function marcarRequiereRegenerar(odtId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: detalle } = await supabase
    .from("prefactura_detalle")
    .select("prefactura_id")
    .eq("odt_id", odtId);
  for (const d of detalle ?? []) {
    const { data: docVigente } = await supabase
      .from("documento_pdf")
      .select("id")
      .eq("prefactura_id", d.prefactura_id)
      .eq("estado", "VIGENTE")
      .maybeSingle();
    if (docVigente) {
      await supabase.from("prefactura").update({ estado: "REQUIERE_REGENERAR" }).eq("id", d.prefactura_id);
    }
  }
  return (detalle ?? []).map((d) => d.prefactura_id);
}

/**
 * Recalcula total_odt/total_descuentos/total de cada prefactura (principal o
 * secundaria de ajuste) que incluye esta ODT, sumando sobre TODAS las ODT
 * congeladas en su propio prefactura_detalle. Necesario porque
 * generar_prefacturas_periodo solo mantiene al día la prefactura PRINCIPAL
 * de cada vehículo/período — una secundaria que comparte esta misma ODT (ver
 * generarPrefacturaSecundariaAction) no se toca ahí, así que sin este
 * recálculo explícito su total quedaría congelado con el valor viejo tras
 * corregir la ODT o aplicarle/quitarle un descuento.
 */
export async function recalcularTotalesPrefacturasDeOdt(odtId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: detalle } = await supabase
    .from("prefactura_detalle")
    .select("prefactura_id")
    .eq("odt_id", odtId);
  const prefacturaIds = [...new Set((detalle ?? []).map((d) => d.prefactura_id))];

  for (const prefacturaId of prefacturaIds) {
    const { data: todoElDetalle } = await supabase
      .from("prefactura_detalle")
      .select("odt_id")
      .eq("prefactura_id", prefacturaId);
    const odtIds = (todoElDetalle ?? []).map((d) => d.odt_id);

    const { data: odts } = await supabase.from("odt").select("valor, valor_final").in("id", odtIds);
    const totalOdt = (odts ?? []).reduce((acc, o) => acc + (o.valor_final ?? o.valor), 0);

    const { data: descuentos } = await supabase
      .from("descuento")
      .select("valor")
      .in("odt_id", odtIds)
      .is("deleted_at", null);
    const totalDescuentos = (descuentos ?? []).reduce((acc, d) => acc + d.valor, 0);

    await supabase
      .from("prefactura")
      .update({ total_odt: totalOdt, total_descuentos: totalDescuentos, total: totalOdt - totalDescuentos })
      .eq("id", prefacturaId);
  }

  return prefacturaIds;
}

export async function corregirOdtAction(
  odtId: string,
  campo: string,
  valorNuevo: string,
  motivo: string,
): Promise<ResultadoAccion> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  if (!esCampoCorregible(campo)) {
    return { ok: false, error: "Ese campo no es corregible." };
  }
  if (!motivo.trim()) {
    return { ok: false, error: "El motivo es obligatorio." };
  }

  const supabase = await createClient();
  const { data: odt, error: errorLectura } = await supabase
    .from("odt")
    .select(`id, periodo_id, ${campo}`)
    .eq("id", odtId)
    .single();
  if (errorLectura || !odt) return { ok: false, error: "ODT no encontrada." };

  const valorAnterior = String((odt as Record<string, unknown>)[campo] ?? "");
  const valorFinal = CAMPOS_MAYUSCULAS.has(campo) ? valorNuevo.trim().toUpperCase() : valorNuevo;

  const actualizacion: OdtUpdate = { [campo]: valorFinal, corregida: true };

  // Corregir la placa no solo cambia el texto: la ODT debe "moverse" al
  // vehículo que corresponde a la placa nueva (o quedar huérfana, como
  // cualquier ODT recién importada, si esa placa todavía no está
  // registrada — generar_prefacturas_periodo la vincula sola más tarde).
  // Sin esto, generar_prefacturas_periodo solo rellena vehiculo_id cuando
  // está en null, así que una ODT ya vinculada se quedaba pegada al
  // vehículo VIEJO para siempre, aunque el texto de placa ya dijera otra.
  if (campo === "placa_normalizada") {
    const { data: vehiculoNuevo } = await supabase
      .from("vehiculo")
      .select("id")
      .eq("placa", valorFinal)
      .is("deleted_at", null)
      .maybeSingle();
    actualizacion.vehiculo_id = vehiculoNuevo?.id ?? null;
  }

  const { error: errorUpdate } = await supabase.from("odt").update(actualizacion).eq("id", odtId);
  if (errorUpdate) return { ok: false, error: "No se pudo corregir la ODT." };

  await supabase.from("odt_correccion").insert({
    odt_id: odtId,
    campo,
    valor_anterior: valorAnterior,
    valor_nuevo: valorFinal,
    motivo,
    usuario: perfil.userId,
  });

  const prefacturaIdsAntes = await marcarRequiereRegenerar(odtId);

  if (campo === "placa_normalizada") {
    // Desvincula la ODT de la prefactura PRINCIPAL vieja (la secundaria/de
    // ajuste, si existe, se deja intacta a propósito: es un documento
    // curado a mano sobre un escaneo físico, no algo que una corrección de
    // placa deba tocar en silencio). generar_prefacturas_periodo, abajo,
    // la vuelve a congelar en la prefactura del vehículo nuevo.
    const { data: detallePrincipal } = await supabase
      .from("prefactura_detalle")
      .select("prefactura_id, prefactura:prefactura_id(es_principal)")
      .eq("odt_id", odtId);
    const idsPrincipales = (detallePrincipal ?? [])
      .filter((d) => (d.prefactura as unknown as { es_principal: boolean } | null)?.es_principal)
      .map((d) => d.prefactura_id);
    if (idsPrincipales.length > 0) {
      await supabase
        .from("prefactura_detalle")
        .delete()
        .eq("odt_id", odtId)
        .in("prefactura_id", idsPrincipales);
    }
  }

  if ((campo === "valor_final" || campo === "placa_normalizada") && odt.periodo_id) {
    await supabase.rpc("generar_prefacturas_periodo", { p_periodo_id: odt.periodo_id });
  }
  if (campo === "valor_final") {
    await recalcularTotalesPrefacturasDeOdt(odtId);
  }

  // Tras generar_prefacturas_periodo, la ODT puede haber quedado congelada
  // en una prefactura NUEVA (la del vehículo correcto) que ya tenía PDF
  // vigente — esa también debe marcarse para regenerar, y recién ahora
  // aparece en prefactura_detalle para poder encontrarla.
  const prefacturaIdsDespues = campo === "placa_normalizada" ? await marcarRequiereRegenerar(odtId) : [];

  const prefacturaIds = [...new Set([...prefacturaIdsAntes, ...prefacturaIdsDespues])];

  revalidatePath("/control-placa");
  revalidatePath("/prefacturas");
  for (const id of prefacturaIds) revalidatePath(`/prefacturas/${id}`);
  return { ok: true };
}

export interface ResultadoCorreccionMasiva extends ResultadoAccion {
  afectadas?: number;
}

/** Reclasifica en bloque todas las ODT de un período con un tipo_ruta dado (ej. REEMPLAZO TRANSPORTE). */
export async function corregirOdtMasivoAction(datos: {
  periodoId: string;
  tipoRutaActual: string;
  nuevoTipoRuta: string;
  nuevoCentroCosto: string;
  motivo: string;
}): Promise<ResultadoCorreccionMasiva> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  if (!datos.motivo.trim()) return { ok: false, error: "El motivo es obligatorio." };

  const nuevoTipoRuta = datos.nuevoTipoRuta.trim().toUpperCase();
  const nuevoCentroCosto = datos.nuevoCentroCosto.trim().toUpperCase();

  const supabase = await createClient();
  const { data: odts, error } = await supabase
    .from("odt")
    .select("id, tipo_ruta, centro_costo_final")
    .eq("periodo_id", datos.periodoId)
    .eq("tipo_ruta", datos.tipoRutaActual);
  if (error) return { ok: false, error: "No se pudo buscar las ODT." };
  if (!odts || odts.length === 0) return { ok: true, afectadas: 0 };

  const ids = odts.map((o) => o.id);
  const { error: errorUpdate } = await supabase
    .from("odt")
    .update({ tipo_ruta: nuevoTipoRuta, centro_costo_final: nuevoCentroCosto })
    .in("id", ids);
  if (errorUpdate) return { ok: false, error: "No se pudo aplicar la corrección masiva." };

  const correcciones = odts.map((o) => ({
    odt_id: o.id,
    campo: "tipo_ruta",
    valor_anterior: o.tipo_ruta,
    valor_nuevo: nuevoTipoRuta,
    motivo: datos.motivo,
    usuario: perfil.userId,
  }));
  await supabase.from("odt_correccion").insert(correcciones);

  await supabase.rpc("generar_prefacturas_periodo", { p_periodo_id: datos.periodoId });

  const prefacturaIdsAfectadas = new Set<string>();
  for (const odtId of ids) {
    const marcadas = await marcarRequiereRegenerar(odtId);
    for (const id of marcadas) prefacturaIdsAfectadas.add(id);
  }

  revalidatePath("/control-placa");
  revalidatePath("/prefacturas");
  for (const id of prefacturaIdsAfectadas) revalidatePath(`/prefacturas/${id}`);
  return { ok: true, afectadas: ids.length };
}
