"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { correoPermitido, mensajeCorreoNoPermitido } from "@/lib/auth/correo-permitido";
import { createClient } from "@/lib/supabase/server";

const credencialesSchema = z.object({
  email: z
    .string()
    .email("Ingresa un correo válido.")
    .refine(correoPermitido, { message: mensajeCorreoNoPermitido }),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

export interface EstadoLogin {
  error?: string;
}

export async function iniciarSesion(_estado: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const parsed = credencialesSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/dashboard");
}
