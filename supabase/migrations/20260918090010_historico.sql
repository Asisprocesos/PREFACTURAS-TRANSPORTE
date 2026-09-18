-- Histórico: índice liviano para búsquedas de largo plazo y archivo de
-- períodos cerrados.

create table public.odt_indice_historico (
  id uuid primary key default gen_random_uuid(),
  guia text not null,
  placa text,
  periodo_id uuid references public.periodo (id),
  valor numeric(12, 2),
  created_at timestamptz not null default now()
);
create index odt_indice_historico_guia_idx on public.odt_indice_historico (guia);
create index odt_indice_historico_placa_idx on public.odt_indice_historico (placa);
create index odt_indice_historico_periodo_idx on public.odt_indice_historico (periodo_id);

comment on table public.odt_indice_historico is
  'Índice liviano de ODT históricas para búsqueda rápida tras archivar un período (evita escanear `odt` completa).';

create table public.archivo_periodo (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references public.periodo (id),
  storage_key text not null,
  filas integer,
  checksum text,
  archivado_en timestamptz not null default now(),
  archivado_por uuid references auth.users (id)
);
create index archivo_periodo_periodo_idx on public.archivo_periodo (periodo_id);

comment on table public.archivo_periodo is
  'Respaldo exportado de un período archivado (bucket `archivo`), ver política de archivo en README.md.';
