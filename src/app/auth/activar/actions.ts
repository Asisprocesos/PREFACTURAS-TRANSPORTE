"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const claveSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirmar: z.string(),
  })
  .refine((datos) => datos.password === datos.confirmar, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmar"],
  });

export interface EstadoActivarCuenta {
  error?: string;
}

/**
 * Se llama con la sesión temporal que deja el enlace de invitación (ver
 * redirectTo en invitarUsuario). Sin esa sesión no hay a quién asignarle la
 * contraseña: el enlace expiró, ya se usó, o el usuario llegó acá sin pasar
 * por /auth/callback.
 */
export async function establecerClave(
  _estado: EstadoActivarCuenta,
  formData: FormData,
): Promise<EstadoActivarCuenta> {
  const parsed = claveSchema.safeParse({
    password: formData.get("password"),
    confirmar: formData.get("confirmar"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "El enlace expiró o ya se usó. Pide al administrador que te reenvíe la invitación." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "No se pudo guardar la contraseña." };
  }

  redirect("/dashboard");
}
