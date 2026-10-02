import "server-only";

import { BUSQUEDA_POR_TABLA } from "@/lib/auditoria/display";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type AuditoriaRow = Database["public"]["Tables"]["auditoria"]["Row"];

export interface EntradaAuditoria extends AuditoriaRow {
  usuarioNombre: string | null;
  usuarioEmail: string | null;
}

export interface FiltrosAuditoria {
  desde?: string;
  hasta?: string;
  usuarioId?: string;
  tabla?: string;
  accion?: string;
  /** Buscador dinámico: solo se aplica si `tabla` está definida y tiene un campo configurado en BUSQUEDA_POR_TABLA. */
  busqueda?: string;
}

export interface ListarAuditoriaParams extends FiltrosAuditoria {
  pagina: number;
  tamanoPagina: number;
}

export interface ListarAuditoriaResultado {
  filas: EntradaAuditoria[];
  total: number;
}

/**
 * Lista la auditoría genérica con filtros y paginación, resolviendo cada
 * `usuario` (uuid de auth.users) a nombre/email vía Admin API — igual que
 * listarUsuarios() en @/lib/usuarios/queries, porque auth.users no es
 * consultable con la key normal. Llamar siempre detrás de
 * requireRole(['ADMIN']).
 */
export async function listarAuditoria({
  pagina,
  tamanoPagina,
  desde,
  hasta,
  usuarioId,
  tabla,
  accion,
  busqueda,
}: ListarAuditoriaParams): Promise<ListarAuditoriaResultado> {
  const supabase = await createClient();
  const desdeIdx = (pagina - 1) * tamanoPagina;
  const hastaIdx = desdeIdx + tamanoPagina - 1;

  let query = supabase
    .from("auditoria")
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false })
    .range(desdeIdx, hastaIdx);

  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);
  if (usuarioId) query = query.eq("usuario", usuarioId);
  if (tabla) query = query.eq("tabla", tabla);
  if (accion) query = query.eq("accion", accion);

  // Buscador dinámico: el campo relevante cambia según el módulo (guía para
  // ODT, número para prefactura, placa para vehículo, etc. — ver
  // BUSQUEDA_POR_TABLA), así que solo aplica con un módulo ya elegido. Busca
  // en `antes` y `despues` a la vez porque una fila DELETE solo tiene
  // `antes`, y una INSERT solo `despues`.
  const terminoBusqueda = busqueda?.trim();
  const configBusqueda = tabla ? BUSQUEDA_POR_TABLA[tabla] : undefined;
  if (terminoBusqueda && configBusqueda) {
    const condiciones = configBusqueda.campos.flatMap((campo) => [
      `antes->>${campo}.ilike.%${terminoBusqueda}%`,
      `despues->>${campo}.ilike.%${terminoBusqueda}%`,
    ]);
    query = query.or(condiciones.join(","));
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const usuarioIds = [...new Set((data ?? []).map((f) => f.usuario).filter((id): id is string => !!id))];
  const usuarios = usuarioIds.length > 0 ? await resolverUsuarios(usuarioIds) : new Map();

  const filas: EntradaAuditoria[] = (data ?? []).map((f) => {
    const u = f.usuario ? usuarios.get(f.usuario) : undefined;
    return { ...f, usuarioNombre: u?.nombre ?? null, usuarioEmail: u?.email ?? null };
  });

  return { filas, total: count ?? 0 };
}

async function resolverUsuarios(
  ids: string[],
): Promise<Map<string, { nombre: string | null; email: string | null }>> {
  const admin = createAdminClient();
  const [{ data: authData, error: authError }, { data: perfiles, error: perfilesError }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("perfil_usuario").select("user_id, nombre"),
  ]);
  if (authError) throw authError;
  if (perfilesError) throw perfilesError;

  const nombresPorId = new Map((perfiles ?? []).map((p) => [p.user_id, p.nombre]));
  const mapa = new Map<string, { nombre: string | null; email: string | null }>();
  for (const id of ids) {
    const user = authData.users.find((u) => u.id === id);
    mapa.set(id, { nombre: nombresPorId.get(id) ?? null, email: user?.email ?? null });
  }
  return mapa;
}
