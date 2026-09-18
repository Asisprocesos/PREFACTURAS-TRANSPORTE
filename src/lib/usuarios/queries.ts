import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { RolUsuario } from "@/types/database.types";

export interface UsuarioConPerfil {
  userId: string;
  email: string | null;
  nombre: string | null;
  rol: RolUsuario;
  activo: boolean;
  creadoEn: string;
}

/**
 * Lista usuarios cruzando `auth.users` (vía Admin API, para el email) con
 * `perfil_usuario` (rol/activo). Requiere `createAdminClient()` porque
 * `auth.users` no es consultable con la anon/authenticated key. Llamar
 * SIEMPRE detrás de `requireRole(['ADMIN'])`.
 */
export async function listarUsuarios(): Promise<UsuarioConPerfil[]> {
  const admin = createAdminClient();

  const [{ data: authData, error: authError }, { data: perfiles, error: perfilesError }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("perfil_usuario").select("user_id, nombre, rol, activo, created_at"),
  ]);

  if (authError) throw authError;
  if (perfilesError) throw perfilesError;

  const perfilesPorId = new Map((perfiles ?? []).map((p) => [p.user_id, p]));

  return authData.users
    .map((u) => {
      const perfil = perfilesPorId.get(u.id);
      return {
        userId: u.id,
        email: u.email ?? null,
        nombre: perfil?.nombre ?? null,
        rol: perfil?.rol ?? "CONSULTA",
        activo: perfil?.activo ?? true,
        creadoEn: u.created_at,
      } satisfies UsuarioConPerfil;
    })
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}
