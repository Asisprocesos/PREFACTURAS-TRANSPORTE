-- Documentos PDF versionados y cola de envío de correo.

create table public.documento_pdf (
  id uuid primary key default gen_random_uuid(),
  prefactura_id uuid not null references public.prefactura (id) on delete cascade,
  nombre_archivo text not null, -- "{PLACA} - {RUC}.pdf", el que ve el usuario
  storage_provider text not null default 'supabase',
  storage_key text not null,    -- prefacturas/{AAAA}/{MM}/{RUC}/{NUMERO}_v{version}.pdf
  version integer not null,
  tamano_bytes bigint,
  checksum text,
  generado_por uuid references auth.users (id),
  generado_en timestamptz not null default now(),
  estado public.estado_documento_pdf not null default 'VIGENTE',
  constraint documento_pdf_version_key unique (prefactura_id, version)
);
create index documento_pdf_prefactura_idx on public.documento_pdf (prefactura_id);
create unique index documento_pdf_vigente_unico
  on public.documento_pdf (prefactura_id) where estado = 'VIGENTE';

comment on table public.documento_pdf is
  'Versiones del PDF de cada prefactura. La fuente de verdad es esta tabla, no el listado del bucket. Regenerar crea version+1 y marca la anterior REEMPLAZADO.';

create table public.lote_proceso (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_lote_proceso not null,
  total integer not null default 0,
  exitosos integer not null default 0,
  fallidos integer not null default 0,
  estado public.estado_lote_proceso not null default 'PENDIENTE',
  iniciado_por uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.lote_proceso
  for each row execute function public.set_updated_at();

comment on table public.lote_proceso is
  'Lote de procesamiento masivo (PDF/CORREO/VALIDACION), alimenta el progreso en tiempo real y los reportes de errores.';

create table public.envio_correo (
  id uuid primary key default gen_random_uuid(),
  prefactura_id uuid not null references public.prefactura (id),
  documento_pdf_id uuid references public.documento_pdf (id),
  lote_id uuid references public.lote_proceso (id),
  destinatarios_to jsonb not null default '[]'::jsonb,
  destinatarios_cc jsonb not null default '[]'::jsonb,
  asunto text not null,
  cuerpo text,
  estado public.estado_envio not null default 'PENDIENTE',
  intentos integer not null default 0,
  proximo_intento timestamptz,
  message_id text,
  error text,
  enviado_por uuid references auth.users (id),
  enviado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index envio_correo_prefactura_idx on public.envio_correo (prefactura_id);
create index envio_correo_lote_idx on public.envio_correo (lote_id);
-- Cola: el worker selecciona por estado + proximo_intento con FOR UPDATE SKIP LOCKED.
create index envio_correo_cola_idx on public.envio_correo (estado, proximo_intento);
create trigger set_updated_at before update on public.envio_correo
  for each row execute function public.set_updated_at();

comment on table public.envio_correo is
  'Cola de envío de correo (una fila por prefactura a enviar). Procesada por /api/jobs/email con FOR UPDATE SKIP LOCKED.';
