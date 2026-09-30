"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { defaultAppConfig } from "@/config/app.config";
import { obtenerOrigen } from "@/lib/auth/origen";
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
  const { error } = await supabase
    .from("perfil_usuario")
    .update({ rol: parsedRol.data })
    .eq("user_id", userId);
  if (error) {
    return { error: "No se pudo cambiar el rol." };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

const estadoUsuarioSchema = z.enum(["ACTIVO", "INACTIVO", "ELIMINAR"]);

/** Nunca eliminar por debajo de este total de usuarios registrados, para que el sistema siempre tenga con quién entrar. */
const MINIMO_USUARIOS = 2;

/**
 * Un solo select en la tabla de Usuarios con tres opciones: Activo/Inactivo
 * (activa o desactiva el perfil, igual que antes) y Eliminar (borra la
 * cuenta de Supabase Auth). Eliminar solo funciona si el usuario no tiene
 * actividad registrada todavía (correcciones, PDFs generados, ODT
 * importadas, etc. lo referencian por FK sin cascada, a propósito, para no
 * perder ese historial) — si falla por eso, el mensaje sugiere desactivar
 * en su lugar. Tampoco deja eliminar si el total de usuarios registrados
 * quedaría por debajo de MINIMO_USUARIOS.
 */
export async function cambiarEstadoUsuarioAction(
  _estado: EstadoAccionUsuario,
  formData: FormData,
): Promise<EstadoAccionUsuario> {
  const perfil = await requireRole(["ADMIN"]);

  const userId = String(formData.get("userId") ?? "");
  const parsedEstado = estadoUsuarioSchema.safeParse(formData.get("estado"));
  if (!userId || !parsedEstado.success) {
    return { error: "Datos inválidos." };
  }
  if (userId === perfil.userId) {
    return { error: "No puedes cambiar tu propio estado desde aquí." };
  }

  if (parsedEstado.data === "ELIMINAR") {
    const supabaseConteo = await createClient();
    const { count } = await supabaseConteo.from("perfil_usuario").select("*", { count: "exact", head: true });
    if ((count ?? 0) <= MINIMO_USUARIOS) {
      return { error: `Debe haber al menos ${MINIMO_USUARIOS} usuarios registrados en el sistema.` };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return {
        error:
          "No se pudo eliminar: el usuario tiene actividad registrada en el sistema. Desactívalo en su lugar.",
      };
    }
    revalidatePath("/usuarios");
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfil_usuario")
    .update({ activo: parsedEstado.data === "ACTIVO" })
    .eq("user_id", userId);
  if (error) {
    return { error: "No se pudo actualizar el estado." };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

// permitirOtroDominio: casilla del formulario para que un ADMIN autorice,
// caso por caso, un correo que no sea @grupolaar.com (ej. un usuario de
// respaldo). Sin la casilla se mantiene la restricción de siempre.
const invitacionSchema = z
  .object({
    email: z.string().email("Ingresa un correo válido."),
    nombre: z.string().min(1, "Ingresa un nombre."),
    permitirOtroDominio: z.boolean(),
  })
  .refine(
    (datos) =>
      datos.permitirOtroDominio ||
      datos.email.toLowerCase().endsWith(`@${defaultAppConfig.dominioCorreoPermitido}`),
    {
      message: `El correo debe ser @${defaultAppConfig.dominioCorreoPermitido}, o marca la casilla para autorizar una excepción.`,
      path: ["email"],
    },
  );

export async function invitarUsuario(
  _estado: EstadoAccionUsuario,
  formData: FormData,
): Promise<EstadoAccionUsuario> {
  await requireRole(["ADMIN"]);

  const parsed = invitacionSchema.safeParse({
    email: formData.get("email"),
    nombre: formData.get("nombre"),
    permitirOtroDominio: formData.get("permitirOtroDominio") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const origen = await obtenerOrigen();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    // permitir_otro_dominio: leído por el trigger validar_dominio_correo
    // (ver migración 20260930140000) para no rechazar la excepción ahí
    // también — la validación de la app sola no alcanza, es defensa en
    // profundidad a nivel de base de datos.
    data: { nombre: parsed.data.nombre, permitir_otro_dominio: parsed.data.permitirOtroDominio },
    // Supabase no soporta PKCE en invitaciones (ver tipos de
    // inviteUserByEmail): el enlace del correo entrega la sesión como hash
    // (#access_token=...), no como ?code=, así que NO pasa por
    // /auth/callback (ese solo sabe leer ?code=) sino directo a
    // /auth/activar, que la toma del hash en el navegador. Ahí el invitado
    // define su propia contraseña — hasta ahora no existía esa pantalla y
    // el enlace lo dejaba sin forma de entrar.
    redirectTo: `${origen}/auth/activar`,
  });

  if (error) {
    return { error: `No se pudo invitar: ${error.message}` };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}
