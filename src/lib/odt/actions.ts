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
  "valor",
  "tipo_ruta",
  "centro_costo_final",
  "regional_origen_texto",
] as const;
type CampoCorregible = (typeof CAMPOS_CORREGIBLES)[number];

function esCampoCorregible(campo: string): campo is CampoCorregible {
  return (CAMPOS_CORREGIBLES as readonly string[]).includes(campo);
}

async function marcarRequiereRegenerar(odtId: string) {
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

  const { error: errorUpdate } = await supabase
    .from("odt")
    .update({ [campo]: valorNuevo, corregida: true } as OdtUpdate)
    .eq("id", odtId);
  if (errorUpdate) return { ok: false, error: "No se pudo corregir la ODT." };

  await supabase.from("odt_correccion").insert({
    odt_id: odtId,
    campo,
    valor_anterior: valorAnterior,
    valor_nuevo: valorNuevo,
    motivo,
    usuario: perfil.userId,
  });

  await marcarRequiereRegenerar(odtId);

  if ((campo === "valor" || campo === "placa_normalizada") && odt.periodo_id) {
    await supabase.rpc("generar_prefacturas_periodo", { p_periodo_id: odt.periodo_id });
  }

  revalidatePath("/control-placa");
  revalidatePath("/prefacturas");
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
    .update({ tipo_ruta: datos.nuevoTipoRuta, centro_costo_final: datos.nuevoCentroCosto })
    .in("id", ids);
  if (errorUpdate) return { ok: false, error: "No se pudo aplicar la corrección masiva." };

  const correcciones = odts.map((o) => ({
    odt_id: o.id,
    campo: "tipo_ruta",
    valor_anterior: o.tipo_ruta,
    valor_nuevo: datos.nuevoTipoRuta,
    motivo: datos.motivo,
    usuario: perfil.userId,
  }));
  await supabase.from("odt_correccion").insert(correcciones);

  await supabase.rpc("generar_prefacturas_periodo", { p_periodo_id: datos.periodoId });

  revalidatePath("/control-placa");
  revalidatePath("/prefacturas");
  return { ok: true, afectadas: ids.length };
}
