-- Maestros: transportistas, vehículos, conductores y correos de contacto
-- (réplica de las hojas VEHICULOS y BD CORREOS del macro .xlsb).

create table public.transportista (
  id uuid primary key default gen_random_uuid(),
  ruc text not null,
  razon_social text not null,
  tipo_transportista text,
  activo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create unique index transportista_ruc_key on public.transportista (ruc) where deleted_at is null;
create index transportista_razon_social_trgm on public.transportista using gin (razon_social gin_trgm_ops);
create trigger set_updated_at before update on public.transportista
  for each row execute function public.set_updated_at();

comment on table public.transportista is 'Maestro de transportistas (contratista/RUC), derivado de la hoja VEHICULOS.';

create table public.vehiculo (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  transportista_id uuid references public.transportista (id),
  propietario text,
  marca text,
  modelo text,
  anio integer,
  tonelaje numeric(10, 2),
  tipo_vehiculo text,
  largo numeric(10, 2),
  alto numeric(10, 2),
  ancho numeric(10, 2),
  cubicaje numeric(12, 4),
  regional_id uuid references public.regional (id),
  activo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint vehiculo_placa_mayusculas check (placa = upper(placa))
);
create unique index vehiculo_placa_key on public.vehiculo (placa) where deleted_at is null;
create index vehiculo_placa_trgm on public.vehiculo using gin (placa gin_trgm_ops);
create index vehiculo_transportista_idx on public.vehiculo (transportista_id);
create trigger set_updated_at before update on public.vehiculo
  for each row execute function public.set_updated_at();

comment on table public.vehiculo is 'Maestro de placas (hoja VEHICULOS).';

create table public.conductor (
  id uuid primary key default gen_random_uuid(),
  nombres text,
  apellidos text,
  identificacion text,
  activo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create unique index conductor_identificacion_key on public.conductor (identificacion) where deleted_at is null and identificacion is not null;
create index conductor_nombres_trgm on public.conductor using gin ((coalesce(apellidos, '') || ' ' || coalesce(nombres, '')) gin_trgm_ops);
create trigger set_updated_at before update on public.conductor
  for each row execute function public.set_updated_at();

comment on table public.conductor is 'Maestro de conductores (hoja VEHICULOS, columna Conductor).';

create table public.vehiculo_conductor (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references public.vehiculo (id) on delete cascade,
  conductor_id uuid not null references public.conductor (id) on delete cascade,
  vigente_desde date not null default current_date,
  vigente_hasta date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint vehiculo_conductor_vigencia_check check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);
create index vehiculo_conductor_vehiculo_idx on public.vehiculo_conductor (vehiculo_id);
create index vehiculo_conductor_conductor_idx on public.vehiculo_conductor (conductor_id);
-- Solo una asignación vigente (vigente_hasta null) por vehículo a la vez.
create unique index vehiculo_conductor_vigente_unica on public.vehiculo_conductor (vehiculo_id) where vigente_hasta is null;

comment on table public.vehiculo_conductor is 'Historial de asignación conductor <-> vehículo.';

create table public.contacto_correo (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid references public.vehiculo (id) on delete cascade,
  transportista_id uuid references public.transportista (id) on delete cascade,
  email text not null,
  tipo public.tipo_contacto_correo not null default 'ADICIONAL',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint contacto_correo_dueno_check check (
    (vehiculo_id is not null and transportista_id is null)
    or (vehiculo_id is null and transportista_id is not null)
  ),
  constraint contacto_correo_email_check check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create unique index contacto_correo_vehiculo_email_key
  on public.contacto_correo (vehiculo_id, lower(email)) where vehiculo_id is not null;
create unique index contacto_correo_transportista_email_key
  on public.contacto_correo (transportista_id, lower(email)) where transportista_id is not null;
create trigger set_updated_at before update on public.contacto_correo
  for each row execute function public.set_updated_at();

comment on table public.contacto_correo is
  'Correos de contacto por placa o transportista, normalizado 1 fila por correo (hoja BD CORREOS).';
