-- Prefactura: 1 por (vehículo, período). El correlativo se asigna con
-- `public.siguiente_numero_prefactura()` (ver migración de triggers), que
-- usa la tabla `correlativo` con bloqueo de fila para no dejar huecos bajo
-- concurrencia. Una vez emitido, `numero` no cambia: corregir crea una
-- nueva versión de `documento_pdf`, no un nuevo número.

create table public.correlativo (
  anio integer primary key,
  secuencia integer not null default 0
);

comment on table public.correlativo is
  'Contador por año para la numeración de prefacturas (PF-{AÑO}-{SECUENCIA}).';

create table public.prefactura (
  id uuid primary key default gen_random_uuid(),
  numero text,
  periodo_id uuid not null references public.periodo (id),
  vehiculo_id uuid not null references public.vehiculo (id),
  transportista_id uuid not null references public.transportista (id),
  total_odt numeric(14, 2) not null default 0,
  total_descuentos numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  cantidad_odt integer not null default 0,
  estado public.estado_prefactura not null default 'BORRADOR',
  version_actual integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint prefactura_vehiculo_periodo_key unique (vehiculo_id, periodo_id)
);
create unique index prefactura_numero_key on public.prefactura (numero) where numero is not null;
create index prefactura_periodo_idx on public.prefactura (periodo_id);
create index prefactura_transportista_idx on public.prefactura (transportista_id);
create index prefactura_estado_idx on public.prefactura (estado);
create index prefactura_numero_trgm on public.prefactura using gin (numero gin_trgm_ops);
create trigger set_updated_at before update on public.prefactura
  for each row execute function public.set_updated_at();

comment on table public.prefactura is '1 prefactura por vehículo y período (UPSERT al generar).';

create table public.prefactura_detalle (
  id uuid primary key default gen_random_uuid(),
  prefactura_id uuid not null references public.prefactura (id) on delete cascade,
  odt_id uuid not null references public.odt (id),
  created_at timestamptz not null default now(),
  constraint prefactura_detalle_key unique (prefactura_id, odt_id)
);
create index prefactura_detalle_prefactura_idx on public.prefactura_detalle (prefactura_id);
create index prefactura_detalle_odt_idx on public.prefactura_detalle (odt_id);

comment on table public.prefactura_detalle is
  'Congela el detalle de ODT incluido en cada emisión de la prefactura.';

create table public.descuento (
  id uuid primary key default gen_random_uuid(),
  prefactura_id uuid not null references public.prefactura (id) on delete cascade,
  item text,
  fecha date,
  concepto text,
  valor numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create index descuento_prefactura_idx on public.descuento (prefactura_id);

comment on table public.descuento is 'Descuentos aplicados a una prefactura (hoja DESCUENTOS).';

create table public.factura_transportista (
  id uuid primary key default gen_random_uuid(),
  prefactura_id uuid not null references public.prefactura (id) on delete cascade,
  numero_factura text,
  numero_comprobante text,
  fecha_entrega date,
  valor_factura numeric(14, 2),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create index factura_transportista_prefactura_idx on public.factura_transportista (prefactura_id);
create trigger set_updated_at before update on public.factura_transportista
  for each row execute function public.set_updated_at();

comment on table public.factura_transportista is
  'Conciliación con la factura real del transportista (hoja BD VAL FACT / ENTR. FACT.). Fase posterior; modelo listo desde ya.';
