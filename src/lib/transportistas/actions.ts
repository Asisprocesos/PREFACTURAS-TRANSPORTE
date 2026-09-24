"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { correoFormSchema } from "@/lib/contactos/schema";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { contarTransportistas } from "./queries";
import { transportistaFormSchema, type TransportistaFormValues } from "./schema";

export type { ResultadoAccion };

/** Para el contador en vivo del listado (sondeado desde el cliente). */
export async function contarTransportistasAction(params: {
  eliminados: boolean;
  busqueda?: string;
}): Promise<number> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  return contarTransportistas(params);
}

export async function crearTransportista(valores: TransportistaFormValues): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const parsed = transportistaFormSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transportista")
    .insert({
      ruc: parsed.data.ruc,
      razon_social: parsed.data.razonSocial,
      nombre: parsed.data.nombre,
      tipo_transportista: parsed.data.tipoTransportista || null,
      activo: parsed.data.activo,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un transportista con ese RUC." };
    }
    return { ok: false, error: "No se pudo crear el transportista." };
  }

  revalidatePath("/transportistas");
  return { ok: true, id: data.id };
}

export async function actualizarTransportista(
  id: string,
  valores: TransportistaFormValues,
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const parsed = transportistaFormSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("transportista")
    .update({
      ruc: parsed.data.ruc,
      razon_social: parsed.data.razonSocial,
      nombre: parsed.data.nombre,
      tipo_transportista: parsed.data.tipoTransportista || null,
      activo: parsed.data.activo,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe otro transportista con ese RUC." };
    }
    return { ok: false, error: "No se pudo actualizar el transportista." };
  }

  revalidarVistasDependientes(id);
  return { ok: true, id };
}

/**
 * Vehículos y Prefacturas muestran el nombre/razón social del transportista
 * vía join en vivo (no guardan una copia), pero son rutas dinámicas
 * distintas: revalidatePath("/transportistas") no las alcanza, así que sin
 * esto el Router Cache del cliente puede seguir sirviendo la versión
 * anterior tras editar/eliminar/restaurar un transportista.
 */
function revalidarVistasDependientes(transportistaIds: string | string[]) {
  const ids = Array.isArray(transportistaIds) ? transportistaIds : [transportistaIds];
  revalidatePath("/transportistas");
  for (const id of ids) revalidatePath(`/transportistas/${id}`);
  revalidatePath("/vehiculos");
  revalidatePath("/vehiculos/[id]", "page");
  revalidatePath("/prefacturas");
  revalidatePath("/prefacturas/[id]", "page");
}

export async function cambiarActivoTransportista(id: string, activo: boolean): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const supabase = await createClient();
  const { error } = await supabase.from("transportista").update({ activo }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el estado." };

  revalidatePath("/transportistas");
  revalidatePath(`/transportistas/${id}`);
  return { ok: true, id };
}

export async function agregarCorreoTransportista(
  transportistaId: string,
  valores: { email: string; tipo: "PRINCIPAL" | "ADICIONAL" },
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const parsed = correoFormSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Correo inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contacto_correo").insert({
    transportista_id: transportistaId,
    email: parsed.data.email,
    tipo: parsed.data.tipo,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ese correo ya está registrado para este transportista." };
    }
    return { ok: false, error: "No se pudo agregar el correo." };
  }

  revalidatePath(`/transportistas/${transportistaId}`);
  return { ok: true };
}

export async function eliminarCorreoTransportista(
  transportistaId: string,
  correoId: string,
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const supabase = await createClient();
  const { error } = await supabase.from("contacto_correo").delete().eq("id", correoId);
  if (error) return { ok: false, error: "No se pudo eliminar el correo." };

  revalidatePath(`/transportistas/${transportistaId}`);
  return { ok: true };
}

/**
 * Borrado lógico (deleted_at): desaparece de listas y selectores, pero no
 * se toca físicamente para no romper el historial de ODT/prefacturas que ya
 * lo hayan usado (esas siguen mostrando sus datos vía la relación
 * existente, RLS no filtra por deleted_at). Reversible desde la papelera
 * (ver restaurarTransportistaAction).
 */
export async function eliminarTransportistaAction(id: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("transportista")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar el transportista." };

  revalidarVistasDependientes(id);
  return { ok: true, id };
}

export async function restaurarTransportistaAction(id: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const supabase = await createClient();
  const { error } = await supabase.from("transportista").update({ deleted_at: null }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo restaurar el transportista." };

  revalidarVistasDependientes(id);
  return { ok: true, id };
}

export async function eliminarTransportistasAction(ids: string[]): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  if (ids.length === 0) return { ok: false, error: "No hay transportistas seleccionados." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("transportista")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) return { ok: false, error: "No se pudieron eliminar los transportistas seleccionados." };

  revalidarVistasDependientes(ids);
  return { ok: true };
}

export async function restaurarTransportistasAction(ids: string[]): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  if (ids.length === 0) return { ok: false, error: "No hay transportistas seleccionados." };

  const supabase = await createClient();
  const { error } = await supabase.from("transportista").update({ deleted_at: null }).in("id", ids);
  if (error) return { ok: false, error: "No se pudieron restaurar los transportistas seleccionados." };

  revalidarVistasDependientes(ids);
  return { ok: true };
}

export async function crearTransportistaYRedirigir(valores: TransportistaFormValues) {
  const resultado = await crearTransportista(valores);
  if (resultado.ok && resultado.id) {
    redirect(`/transportistas/${resultado.id}`);
  }
  return resultado;
}
