-- Extensiones y funciones de utilidad compartidas por todas las migraciones
-- siguientes (updated_at automático, correlativo sin huecos, etc).

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- búsqueda por texto (ILIKE / similarity)

-- Mantiene updated_at al día en cualquier tabla que tenga la columna y el
-- trigger `set_updated_at` (ver cada migración de tabla).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE: refresca updated_at = now() en cada fila modificada.';
