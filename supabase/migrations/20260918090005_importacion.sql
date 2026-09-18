-- Importación: mapeo de columnas configurable + staging (nunca se insertan
-- datos directo a `odt` sin pasar por aquí y ser validados).

create table public.mapeo_columna (
  id uuid primary key default gen_random_uuid(),
  plantilla text not null default 'default',
  alias_origen text not null,
  campo_interno text not null,
  transformacion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint mapeo_columna_key unique (plantilla, alias_origen)
);
create trigger set_updated_at before update on public.mapeo_columna
  for each row execute function public.set_updated_at();

comment on table public.mapeo_columna is
  'Alias de columna origen -> campo interno, configurable desde la UI (ej. "Ruta-Zona"/"Ruta/Zona" -> odt.ruta_zona).';

create table public.importacion (
  id uuid primary key default gen_random_uuid(),
  archivo text not null,
  storage_key text not null,
  hash_sha256 text not null,
  hoja text,
  periodo_id uuid references public.periodo (id),
  filas_leidas integer not null default 0,
  filas_validas integer not null default 0,
  filas_con_error integer not null default 0,
  filas_advertencias integer not null default 0,
  estado public.estado_importacion not null default 'BORRADOR',
  usuario uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index importacion_hash_key on public.importacion (hash_sha256);
create index importacion_periodo_idx on public.importacion (periodo_id);
create trigger set_updated_at before update on public.importacion
  for each row execute function public.set_updated_at();

comment on table public.importacion is
  'Una fila por archivo subido. hash_sha256 único evita reimportar el mismo archivo sin avisar.';

create table public.importacion_fila (
  id uuid primary key default gen_random_uuid(),
  importacion_id uuid not null references public.importacion (id) on delete cascade,
  numero_fila integer not null,
  datos_crudos jsonb not null,
  datos_normalizados jsonb,
  errores jsonb not null default '[]'::jsonb,
  advertencias jsonb not null default '[]'::jsonb,
  decision public.decision_fila,
  created_at timestamptz not null default now()
);
create index importacion_fila_importacion_idx on public.importacion_fila (importacion_id);
create index importacion_fila_errores_idx on public.importacion_fila using gin (errores);

comment on table public.importacion_fila is
  'Staging fila a fila de cada importación: datos crudos, normalizados, errores/advertencias y decisión del usuario.';
