import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Cliente con service_role: omite RLS por completo. Uso exclusivo en
 * Route Handlers protegidos (CRON_SECRET) o Server Actions que ya validaron
 * el rol del usuario (perfil_usuario). Nunca importar desde un componente
 * cliente ni exponer `SUPABASE_SERVICE_ROLE_KEY` con prefijo NEXT_PUBLIC_.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
