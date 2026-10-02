-- Catálogo de Tipo de Transportista (FIJO / BACK): hasta ahora transportista.tipo_transportista era texto libre sin validar; este catálogo lo administra, con el mismo patrón ADMIN-only que tipo_ruta_centro_costo (ver RLS abajo). El campo transportista.tipo_transportista NO se vuelve FK: sigue siendo texto suelto, igual que odt.tipo_ruta frente a tipo_ruta_centro_costo, para no romper transportistas ya cargados con un valor que no esté en el catálogo.
create table if not exists public.tipo_transportista (id uuid primary key default gen_random_uuid(), nombre text not null, activo boolean not null default true, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users (id));
create unique index if not exists tipo_transportista_nombre_key on public.tipo_transportista (lower(nombre)) where deleted_at is null;
comment on table public.tipo_transportista is 'Catálogo de tipos de transportista (FIJO, BACK, ...). Se administra solo desde Configuración (ADMIN).';
drop trigger if exists set_updated_at on public.tipo_transportista;
create trigger set_updated_at before update on public.tipo_transportista for each row execute function public.set_updated_at();
drop trigger if exists auditoria_tipo_transportista on public.tipo_transportista;
create trigger auditoria_tipo_transportista after insert or update or delete on public.tipo_transportista for each row execute function public.registrar_auditoria();
alter table public.tipo_transportista enable row level security;
drop policy if exists tipo_transportista_lectura on public.tipo_transportista;
create policy tipo_transportista_lectura on public.tipo_transportista for select using (public.rol_actual() is not null);
drop policy if exists tipo_transportista_admin_escribe on public.tipo_transportista;
create policy tipo_transportista_admin_escribe on public.tipo_transportista for all using (public.rol_actual() = 'ADMIN') with check (public.rol_actual() = 'ADMIN');
insert into public.tipo_transportista (nombre) select 'FIJO' where not exists (select 1 from public.tipo_transportista where lower(nombre) = 'fijo');
insert into public.tipo_transportista (nombre) select 'BACK' where not exists (select 1 from public.tipo_transportista where lower(nombre) = 'back');
