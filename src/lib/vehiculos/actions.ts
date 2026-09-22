"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/roles";
import { correoFormSchema } from "@/lib/contactos/schema";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { vehiculoFormSchema, type VehiculoFormValues } from "./schema";

function aFilaVehiculo(valores: VehiculoFormValues) {
  return {
    placa: valores.placa,
    transportista_id: valores.transportistaId || null,
    propietario: valores.propietario || null,
    marca: valores.marca || null,
    modelo: valores.modelo || null,
    anio: valores.anio ?? null,
    tonelaje: valores.tonelaje ?? null,
    tipo_vehiculo: valores.tipoVehiculo || null,
    largo: valores.largo ?? null,
    alto: valores.alto ?? null,
    ancho: valores.ancho ?? null,
    cubicaje: valores.cubicaje ?? null,
    regional_id: valores.regionalId || null,
    activo: valores.activo,
  };
}

export async function crearVehiculo(valores: VehiculoFormValues): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const parsed = vehiculoFormSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehiculo")
    .insert(aFilaVehiculo(parsed.data))
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un vehículo con esa placa." };
    }
    return { ok: false, error: "No se pudo crear el vehículo." };
  }

  revalidatePath("/vehiculos");
  return { ok: true, id: data.id };
}

export async function actualizarVehiculo(id: string, valores: VehiculoFormValues): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const parsed = vehiculoFormSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vehiculo").update(aFilaVehiculo(parsed.data)).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe otro vehículo con esa placa." };
    }
    return { ok: false, error: "No se pudo actualizar el vehículo." };
  }

  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${id}`);
  return { ok: true, id };
}

export async function cambiarActivoVehiculo(id: string, activo: boolean): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const supabase = await createClient();
  const { error } = await supabase.from("vehiculo").update({ activo }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el estado." };

  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${id}`);
  return { ok: true, id };
}

export async function agregarCorreoVehiculo(
  vehiculoId: string,
  valores: { email: string; tipo: "PRINCIPAL" | "ADICIONAL" },
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const parsed = correoFormSchema.safeParse(valores);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Correo inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contacto_correo").insert({
    vehiculo_id: vehiculoId,
    email: parsed.data.email,
    tipo: parsed.data.tipo,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ese correo ya está registrado para esta placa." };
    }
    return { ok: false, error: "No se pudo agregar el correo." };
  }

  revalidatePath(`/vehiculos/${vehiculoId}`);
  return { ok: true };
}

export async function eliminarCorreoVehiculo(vehiculoId: string, correoId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const supabase = await createClient();
  const { error } = await supabase.from("contacto_correo").delete().eq("id", correoId);
  if (error) return { ok: false, error: "No se pudo eliminar el correo." };

  revalidatePath(`/vehiculos/${vehiculoId}`);
  return { ok: true };
}

/**
 * Registra quién maneja el vehículo ahora mismo: cierra la asignación
 * vigente anterior (si había) y crea una nueva. El PDF de prefactura usa
 * esto para el campo Conductor — sin un conductor registrado, cae de
 * vuelta a adivinar por el campo "Chofer" de las ODT del corte, que no es
 * confiable (texto libre del Excel importado, puede variar entre viajes).
 */
export async function asignarConductorVehiculoAction(
  vehiculoId: string,
  nombreCompleto: string,
): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const nombre = nombreCompleto.trim();
  if (!nombre) return { ok: false, error: "El nombre del conductor es obligatorio." };

  const supabase = await createClient();

  const { data: conductor, error: errorConductor } = await supabase
    .from("conductor")
    .insert({ nombres: nombre })
    .select("id")
    .single();
  if (errorConductor || !conductor) return { ok: false, error: "No se pudo registrar el conductor." };

  const { error: errorCierre } = await supabase
    .from("vehiculo_conductor")
    .update({ vigente_hasta: new Date().toISOString().slice(0, 10) })
    .eq("vehiculo_id", vehiculoId)
    .is("vigente_hasta", null);
  if (errorCierre) return { ok: false, error: "No se pudo cerrar la asignación anterior." };

  const { error: errorAsignacion } = await supabase
    .from("vehiculo_conductor")
    .insert({ vehiculo_id: vehiculoId, conductor_id: conductor.id });
  if (errorAsignacion) return { ok: false, error: "No se pudo asignar el conductor." };

  revalidatePath(`/vehiculos/${vehiculoId}`);
  return { ok: true };
}

/**
 * Borrado lógico (deleted_at): desaparece de listas y selectores, pero no
 * se toca físicamente para no romper el historial de ODT/prefacturas que ya
 * lo hayan usado. No hay "restaurar" en la UI: revertirlo requiere entrar
 * directo a la base de datos.
 */
export async function eliminarVehiculoAction(id: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("vehiculo")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar el vehículo." };

  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${id}`);
  return { ok: true, id };
}

export async function crearVehiculoYRedirigir(valores: VehiculoFormValues) {
  const resultado = await crearVehiculo(valores);
  if (resultado.ok && resultado.id) {
    redirect(`/vehiculos/${resultado.id}`);
  }
  return resultado;
}
