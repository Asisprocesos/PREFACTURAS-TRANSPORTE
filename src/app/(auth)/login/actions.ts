"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

// Sin restricción de dominio: la única forma de tener una cuenta es que un
// ADMIN la invite desde Usuarios (no hay auto-registro), así que el control
// de acceso real ya ocurre ahí, no acá. Ver invitarUsuario en
// src/lib/usuarios/actions.ts, incluida la excepción por correo puntual.
const credencialesSchema = z.object({
  email: z.string().email("Ingresa un correo válido."),
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
