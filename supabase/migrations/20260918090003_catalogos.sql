-- Catálogos: réplica de la hoja DATA LIST del macro .xlsb (períodos, rutas
-- principales -> ruta macro/tarifa/km/horas, tipo de ruta -> centro de
-- costo, calendario laborable) más el catálogo de regionales (hoja REG).

create table public.regional (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text,
  activo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create unique index regional_nombre_key on public.regional (lower(nombre)) where deleted_at is null;
create trigger set_updated_at before update on public.regional
  for each row execute function public.set_updated_at();

comment on table public.regional is 'Catálogo de regionales (hoja REG / REGIONAL).';

-- Período de facturación 13->12 (hoja DATA LIST, columna "#").
create table public.periodo (
  id uuid primary key default gen_random_uuid(),
  numero integer not null,
  nombre text not null, -- ej. "21-13-Aug-12-Sep"
  fecha_inicio date not null,
  fecha_fin date not null,
  estado public.estado_periodo not null default 'ABIERTO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint periodo_numero_key unique (numero),
  constraint periodo_rango_key unique (fecha_inicio, fecha_fin),
  constraint periodo_fechas_check check (fecha_fin > fecha_inicio)
);
create trigger set_updated_at before update on public.periodo
  for each row execute function public.set_updated_at();

comment on table public.periodo is 'Períodos de facturación (hoja DATA LIST: #, INICIO, FIN, nombre).';

-- Ruta principal -> ruta macro / tarifa / km / horas de viaje.
create table public.ruta_macro (
  id uuid primary key default gen_random_uuid(),
  ruta_principal text not null,
  ruta_macro text not null,
  tarifa numeric(12, 2),
  km numeric(10, 2),
  horas_viaje numeric(6, 2),
  activo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create unique index ruta_macro_principal_key on public.ruta_macro (lower(ruta_principal)) where deleted_at is null;
create trigger set_updated_at before update on public.ruta_macro
  for each row execute function public.set_updated_at();

comment on table public.ruta_macro is 'Catálogo ruta principal -> ruta macro/tarifa/km/horas (hoja DATA LIST).';

-- Tipo de ruta -> macro (CORE/TEMU) -> centro de costos.
create table public.tipo_ruta_centro_costo (
  id uuid primary key default gen_random_uuid(),
  tipo_ruta text not null,
  macro public.macro_negocio,
  centro_costo text,
  requiere_revision boolean not null default false,
  activo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create unique index tipo_ruta_centro_costo_key on public.tipo_ruta_centro_costo (lower(tipo_ruta)) where deleted_at is null;
create trigger set_updated_at before update on public.tipo_ruta_centro_costo
  for each row execute function public.set_updated_at();

comment on table public.tipo_ruta_centro_costo is
  'Tipo de Ruta -> MACRO (CORE/TEMU) -> CENTRO DE COSTOS (hoja DATA LIST). requiere_revision=true para casos como REEMPLAZO TRANSPORTE.';

-- Calendario laborable (hoja DATA LIST: FECHA -> DÍA TEXTO -> LABORABLE).
create table public.calendario (
  fecha date primary key,
  dia_texto text not null,
  laborable boolean not null
);

comment on table public.calendario is 'Calendario día a día con indicador de laborable (hoja DATA LIST).';
