/**
 * Tipos generados por Supabase CLI a partir del esquema real:
 *   npm run supabase:types
 *
 * Este archivo es un marcador mínimo hasta que exista un proyecto Supabase
 * (local o remoto) contra el cual generar los tipos reales de
 * `supabase/migrations/`. NO editar a mano una vez generado: el comando
 * anterior sobrescribe este archivo completo.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Marcador laxo (permite `.from("cualquier_tabla")` sin romper el
 * typecheck) hasta que `npm run supabase:types` genere las tablas reales
 * a partir de `supabase/migrations/`.
 */
type TablaGenerica = {
  Row: Record<string, Json>;
  Insert: Record<string, Json>;
  Update: Record<string, Json>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: Record<string, TablaGenerica>;
    Views: Record<string, { Row: Record<string, Json> }>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
