-- ODT: réplica de la hoja BD (base acumulada + columnas calculadas P:AJ).

create table public.odt (
  id uuid primary key default gen_random_uuid(),
  guia text not null,
  importacion_id uuid references public.importacion (id),
  periodo_id uuid references public.periodo (id),
  vehiculo_id uuid references public.vehiculo (id),

  -- Campos crudos del reporte Fénix
  placa_original text,
  placa_normalizada text,
  chofer text,
  ruta text,
  ruta_zona text,
  detalle_ruta text,
  regional_origen_texto text,
  regional_destino_texto text,
  regional_origen_id uuid references public.regional (id),
  regional_destino_id uuid references public.regional (id),
  estado_fenix text, -- valor crudo de "Estado" (siempre "Entregado" en filas insertadas, se guarda para trazabilidad)
  fecha_recepcion date,
  fecha_creacion date not null,
  usuario_fenix text,
  valor numeric(12, 2) not null default 0,
  tipo_costo text,
  tipo_ruta text,

  -- Derivaciones calculadas al importar (réplica de columnas P:AJ de BD)
  valor_final numeric(12, 2),
  ruta_macro text,
  centro_costo_final text,
  core_temu public.macro_negocio,
  dia_texto text,
  semana integer,
  mes integer,
  anio integer,
  laborable boolean,

  corregida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create unique index odt_guia_key on public.odt (guia);
create index odt_periodo_idx on public.odt (periodo_id);
create index odt_vehiculo_idx on public.odt (vehiculo_id);
create index odt_placa_normalizada_idx on public.odt (placa_normalizada);
create index odt_importacion_idx on public.odt (importacion_id);
create index odt_guia_trgm on public.odt using gin (guia gin_trgm_ops);
create index odt_chofer_trgm on public.odt using gin (chofer gin_trgm_ops);
create trigger set_updated_at before update on public.odt
  for each row execute function public.set_updated_at();

comment on table public.odt is
  'Órdenes de transporte entregadas (Estado=Entregado), con sus derivaciones calculadas al importar (ruta macro, centro de costo, CORE/TEMU, período, laborable, etc).';

create table public.odt_correccion (
  id uuid primary key default gen_random_uuid(),
  odt_id uuid not null references public.odt (id) on delete cascade,
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  motivo text not null,
  usuario uuid references auth.users (id),
  fecha timestamptz not null default now()
);
create index odt_correccion_odt_idx on public.odt_correccion (odt_id);

comment on table public.odt_correccion is
  'Historial de correcciones manuales sobre una ODT (placa, fecha, valor, tipo de ruta, centro de costo, regional), siempre con motivo.';
