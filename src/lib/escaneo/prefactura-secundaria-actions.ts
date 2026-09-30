"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { obtenerDescuentosPorOdt } from "@/lib/descuentos/queries";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";
import { generarYGuardarPdf } from "@/pdf/generar-y-guardar";

import { obtenerMatchSesion, obtenerSesionEscaneo, type FilaMatch } from "./queries";

/**
 * "Generar prefactura secundaria" (Validación ODT / Escaneo): cuando el
 * sistema tiene más ODT cargadas que las que existen físicamente, arma una
 * prefactura aparte con solo las ODT confirmadas por el escaneo
 * (ESCANEADA_Y_CARGADA). Es un documento independiente: no busca ni exige
 * que ya exista una prefactura "principal" del vehículo/período, no queda
 * atada a ella de ninguna forma, y recibe su propio número de la secuencia
 * normal (el mismo correlativo que cualquier otra prefactura). Internamente
 * se guarda con es_principal = false solo para no chocar con el índice
 * único que exige una sola principal por vehículo+período — eso no afecta
 * en nada al documento en sí (mismo PDF, mismo flujo de envío).
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

  const cargadas = filas.filter(
    (f) => f.resultado === "ESCANEADA_Y_CARGADA" || f.resultado === "CARGADA_SIN_FISICA",
  ).length;
  const totalOdt = confirmadas.reduce((acc, f) => acc + (f.valor ?? 0), 0);
  const descuentos = await obtenerDescuentosPorOdt(confirmadas.map((f) => f.odt_id));
  const totalDescuentos = [...descuentos.values()].reduce((acc, d) => acc + d.total, 0);

  const { data: nueva, error: errorInsert } = await supabase
    .from("prefactura")
    .insert({
      periodo_id: sesion.periodo_id,
      vehiculo_id: vehiculo.id,
      transportista_id: vehiculo.transportista_id,
      total_odt: totalOdt,
      total_descuentos: totalDescuentos,
      total: totalOdt - totalDescuentos,
      cantidad_odt: confirmadas.length,
      estado: "BORRADOR",
      es_principal: false,
      sesion_escaneo_id: sesionId,
      motivo: `Prefactura de ajuste generada por sesión de escaneo: ${confirmadas.length} de ${cargadas} ODT confirmadas físicamente.`,
      created_by: perfil.userId,
    })
    .select("id")
    .single();
  if (errorInsert || !nueva) {
    return { ok: false, error: "No se pudo crear la prefactura." };
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
  revalidatePath(`/validacion-odt/escaneo/${sesionId}`);

  if (!pdf.ok) {
    return { ok: true, id: nueva.id, error: `Prefactura creada, pero el PDF falló: ${pdf.error}` };
  }
  return { ok: true, id: nueva.id };
}
