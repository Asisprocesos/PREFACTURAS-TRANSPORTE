"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";
import { generarYGuardarPdf } from "@/pdf/generar-y-guardar";

import { obtenerMatchSesion, obtenerSesionEscaneo, type FilaMatch } from "./queries";

/**
 * "Generar prefactura secundaria" (Validación ODT / Escaneo): cuando el
 * sistema tiene más ODT cargadas que las que existen físicamente, arma una
 * prefactura aparte con solo las ODT confirmadas por el escaneo
 * (ESCANEADA_Y_CARGADA), sin tocar la prefactura ni el PDF originales — la
 * placa/período pueden tener 0..N secundarias (ver es_principal en la
 * migración de prefactura_secundaria). El número se deriva del de la
 * original (PF-...-AJ1, -AJ2, ...) para que quede identificable a simple
 * vista sin abrir el registro.
 */
export async function generarPrefacturaSecundariaAction(sesionId: string): Promise<ResultadoAccion> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const sesion = await obtenerSesionEscaneo(sesionId);
  if (!sesion) return { ok: false, error: "Sesión no encontrada." };
  if (!sesion.placa) {
    return { ok: false, error: "Esta acción requiere una sesión de escaneo de una sola placa." };
  }

  const { data: vehiculo } = await supabase
    .from("vehiculo")
    .select("id, transportista_id")
    .eq("placa", sesion.placa)
    .is("deleted_at", null)
    .maybeSingle();
  if (!vehiculo) {
    return { ok: false, error: `No hay vehículo activo registrado con la placa ${sesion.placa}.` };
  }
  if (!vehiculo.transportista_id) {
    return { ok: false, error: "El vehículo no tiene transportista asignado." };
  }

  const { data: original } = await supabase
    .from("prefactura")
    .select("id, numero")
    .eq("vehiculo_id", vehiculo.id)
    .eq("periodo_id", sesion.periodo_id)
    .eq("es_principal", true)
    .maybeSingle();
  if (!original) {
    return { ok: false, error: "No existe la prefactura original de este vehículo en este período." };
  }
  if (!original.numero) {
    return { ok: false, error: "La prefactura original todavía no tiene número asignado." };
  }

  const { filas } = await obtenerMatchSesion(sesionId);
  const confirmadas = filas.filter(
    (f): f is FilaMatch & { odt_id: string } => f.resultado === "ESCANEADA_Y_CARGADA" && f.odt_id !== null,
  );
  if (confirmadas.length === 0) {
    return {
      ok: false,
      error: "No hay ODT confirmadas físicamente en esta sesión para generar la prefactura.",
    };
  }

  const { count: secundariasPrevias } = await supabase
    .from("prefactura")
    .select("id", { count: "exact", head: true })
    .eq("prefactura_original_id", original.id);
  const numero = `${original.numero}-AJ${(secundariasPrevias ?? 0) + 1}`;

  const cargadas = filas.filter(
    (f) => f.resultado === "ESCANEADA_Y_CARGADA" || f.resultado === "CARGADA_SIN_FISICA",
  ).length;
  const totalOdt = confirmadas.reduce((acc, f) => acc + (f.valor ?? 0), 0);

  const { data: nueva, error: errorInsert } = await supabase
    .from("prefactura")
    .insert({
      numero,
      periodo_id: sesion.periodo_id,
      vehiculo_id: vehiculo.id,
      transportista_id: vehiculo.transportista_id,
      total_odt: totalOdt,
      total: totalOdt,
      cantidad_odt: confirmadas.length,
      estado: "BORRADOR",
      es_principal: false,
      prefactura_original_id: original.id,
      sesion_escaneo_id: sesionId,
      motivo: `Ajuste por sesión de escaneo: ${confirmadas.length} de ${cargadas} ODT confirmadas físicamente.`,
      created_by: perfil.userId,
    })
    .select("id")
    .single();
  if (errorInsert || !nueva) {
    return { ok: false, error: "No se pudo crear la prefactura secundaria." };
  }

  const { error: errorDetalle } = await supabase
    .from("prefactura_detalle")
    .insert(confirmadas.map((f) => ({ prefactura_id: nueva.id, odt_id: f.odt_id })));
  if (errorDetalle) {
    return {
      ok: false,
      error: "La prefactura se creó pero no se pudo vincular el detalle de ODT.",
      id: nueva.id,
    };
  }

  const pdf = await generarYGuardarPdf(nueva.id, perfil.userId);

  revalidatePath("/prefacturas");
  revalidatePath(`/prefacturas/${nueva.id}`);
  revalidatePath(`/prefacturas/${original.id}`);
  revalidatePath(`/validacion-odt/escaneo/${sesionId}`);

  if (!pdf.ok) {
    return { ok: true, id: nueva.id, error: `Prefactura ${numero} creada, pero el PDF falló: ${pdf.error}` };
  }
  return { ok: true, id: nueva.id };
}
