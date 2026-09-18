"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

import { correoFormSchema, transportistaFormSchema, type TransportistaFormValues } from "./schema";

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
  id?: string;
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

  revalidatePath("/transportistas");
  revalidatePath(`/transportistas/${id}`);
  return { ok: true, id };
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

export async function crearTransportistaYRedirigir(valores: TransportistaFormValues) {
  const resultado = await crearTransportista(valores);
  if (resultado.ok && resultado.id) {
    redirect(`/transportistas/${resultado.id}`);
  }
  return resultado;
}
