"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { defaultAppConfig } from "@/config/app.config";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface EstadoAccionUsuario {
  error?: string;
  ok?: boolean;
}

const rolSchema = z.enum(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);

export async function cambiarRolUsuario(
  _estado: EstadoAccionUsuario,
  formData: FormData,
): Promise<EstadoAccionUsuario> {
  await requireRole(["ADMIN"]);

  const userId = String(formData.get("userId") ?? "");
  const parsedRol = rolSchema.safeParse(formData.get("rol"));
  if (!userId || !parsedRol.success) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("perfil_usuario").update({ rol: parsedRol.data }).eq("user_id", userId);
  if (error) {
    return { error: "No se pudo cambiar el rol." };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function cambiarActivoUsuario(
  _estado: EstadoAccionUsuario,
  formData: FormData,
): Promise<EstadoAccionUsuario> {
  await requireRole(["ADMIN"]);

  const userId = String(formData.get("userId") ?? "");
  const activo = formData.get("activo") === "true";
  if (!userId) {
    return { error: "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("perfil_usuario").update({ activo }).eq("user_id", userId);
  if (error) {
    return { error: "No se pudo actualizar el estado." };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

const invitacionSchema = z.object({
  email: z
    .string()
    .email("Ingresa un correo válido.")
    .refine((email) => email.toLowerCase().endsWith(`@${defaultAppConfig.dominioCorreoPermitido}`), {
      message: `El correo debe ser @${defaultAppConfig.dominioCorreoPermitido}.`,
    }),
  nombre: z.string().min(1, "Ingresa un nombre."),
});

export async function invitarUsuario(
  _estado: EstadoAccionUsuario,
  formData: FormData,
): Promise<EstadoAccionUsuario> {
  await requireRole(["ADMIN"]);

  const parsed = invitacionSchema.safeParse({
    email: formData.get("email"),
    nombre: formData.get("nombre"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { nombre: parsed.data.nombre },
  });

  if (error) {
    return { error: `No se pudo invitar: ${error.message}` };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}
