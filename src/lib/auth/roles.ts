import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { RolUsuario } from "@/types/database.types";

export interface PerfilActual {
  userId: string;
  email: string | null;
  nombre: string | null;
  rol: RolUsuario;
}

/**
 * Perfil del usuario autenticado actual, o null si no hay sesión o el
 * perfil no existe/está inactivo (perfil_usuario.activo = false no
 * devuelve fila por la política de RLS, que exige rol_actual() no nulo
 * únicamente para las políticas de OTRAS tablas; aquí se lee perfil_usuario
 * directo así que se filtra igual por activo).
 */
export async function obtenerPerfilActual(): Promise<PerfilActual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfil_usuario")
    .select("nombre, rol, activo")
    .eq("user_id", user.id)
    .single();

  if (!perfil || !perfil.activo) return null;

  return { userId: user.id, email: user.email ?? null, nombre: perfil.nombre, rol: perfil.rol };
}

/**
 * Exige que el usuario esté autenticado y tenga uno de los roles dados.
 * Redirige a /login si no hay sesión, o a /no-autorizado si el rol no
 * alcanza. Pensado para el inicio de una Server Action o de un Server
 * Component de una pantalla restringida.
 */
export async function requireRole(rolesPermitidos: RolUsuario[]): Promise<PerfilActual> {
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    redirect("/login");
  }

  if (!rolesPermitidos.includes(perfil.rol)) {
    redirect("/no-autorizado");
  }

  return perfil;
}
