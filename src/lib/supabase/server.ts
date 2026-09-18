import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Usa la anon key + cookies de sesión del usuario: respeta RLS,
 * nunca escala privilegios. Para tareas que requieren service_role, usar
 * exclusivamente `src/lib/supabase/admin.ts`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Se llama desde un Server Component: la sesión se refresca
            // igualmente vía middleware, este error es esperado y se ignora.
          }
        },
      },
    },
  );
}
