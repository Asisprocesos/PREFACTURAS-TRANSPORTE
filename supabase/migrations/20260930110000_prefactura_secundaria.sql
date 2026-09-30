-- Prefactura secundaria (de ajuste): cuando el escaneo físico confirma
-- menos ODT que las cargadas en el sistema para una placa/período (ver
-- Validación ODT / Escaneo), el operador puede generar una prefactura
-- adicional con solo las ODT confirmadas físicamente, sin tocar la
-- prefactura ni el PDF originales. `es_principal` distingue cuál es la
-- prefactura "de verdad" del período (la que sigue exigiendo el índice
-- único vehiculo_id+periodo_id); las secundarias quedan vinculadas a su
-- original vía `prefactura_original_id` y, cuando aplica, a la sesión de
-- escaneo que las generó.

alter table public.prefactura
  add column es_principal boolean not null default true,
  add column prefactura_original_id uuid references public.prefactura (id),
  add column sesion_escaneo_id uuid references public.sesion_escaneo (id),
  add column motivo text;

create index prefactura_original_idx on public.prefactura (prefactura_original_id)
  where prefactura_original_id is not null;

comment on column public.prefactura.es_principal is
  'true = la prefactura del período para ese vehículo (única, ver prefactura_vehiculo_periodo_key). false = secundaria/ajuste, no cuenta para esa unicidad.';
comment on column public.prefactura.prefactura_original_id is
  'Solo en secundarias: la prefactura principal que ajustan.';
comment on column public.prefactura.sesion_escaneo_id is
  'Solo en secundarias generadas desde Validación ODT / Escaneo: la sesión que las originó.';
comment on column public.prefactura.motivo is
  'Solo en secundarias: por qué se generó (ej. "3 de 10 ODT confirmadas físicamente").';

-- El UNIQUE original exigía como máximo 1 fila por (vehículo, período) sin
-- importar nada más; se reemplaza por un índice parcial que solo aplica a
-- las principales, para permitir 0..N secundarias del mismo vehículo/período.
alter table public.prefactura drop constraint prefactura_vehiculo_periodo_key;
create unique index prefactura_vehiculo_periodo_principal_key
  on public.prefactura (vehiculo_id, periodo_id)
  where es_principal;

-- generar_prefacturas_periodo solo crea/actualiza principales: el ON
-- CONFLICT debe apuntar al nuevo índice parcial (mismo cuerpo que la
-- migración original, solo cambia el target del ON CONFLICT).
create or replace function public.generar_prefacturas_periodo(p_periodo_id uuid)
returns table (prefacturas_creadas integer, prefacturas_actualizadas integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_creadas integer := 0;
  v_actualizadas integer := 0;
begin
  update odt o
  set vehiculo_id = v.id
  from vehiculo v
  where o.periodo_id = p_periodo_id
    and o.vehiculo_id is null
    and o.placa_normalizada = v.placa
    and v.deleted_at is null;

  with agregado as (
    select
      o.vehiculo_id,
      v.transportista_id,
      count(*) as cantidad_odt,
      sum(coalesce(o.valor_final, o.valor)) as total_odt
    from odt o
    join vehiculo v on v.id = o.vehiculo_id
    where o.periodo_id = p_periodo_id
      and o.vehiculo_id is not null
      and v.transportista_id is not null
    group by o.vehiculo_id, v.transportista_id
  ),
  upsert as (
    insert into prefactura (periodo_id, vehiculo_id, transportista_id, total_odt, total, cantidad_odt, estado)
    select p_periodo_id, a.vehiculo_id, a.transportista_id, a.total_odt, a.total_odt, a.cantidad_odt, 'BORRADOR'
    from agregado a
    on conflict (vehiculo_id, periodo_id) where es_principal do update
      set total_odt = excluded.total_odt,
          total = excluded.total_odt - prefactura.total_descuentos,
          cantidad_odt = excluded.cantidad_odt,
          transportista_id = excluded.transportista_id,
          estado = case
            when prefactura.estado in ('BORRADOR', 'CON_NOVEDADES') then 'BORRADOR'
            else prefactura.estado
          end
    returning (xmax = 0) as es_nuevo
  )
  select
    count(*) filter (where es_nuevo)::integer,
    count(*) filter (where not es_nuevo)::integer
  into v_creadas, v_actualizadas
  from upsert;

  -- Congela el detalle de ODT de cada prefactura principal del período.
  insert into prefactura_detalle (prefactura_id, odt_id)
  select p.id, o.id
  from odt o
  join prefactura p on p.vehiculo_id = o.vehiculo_id and p.periodo_id = p_periodo_id and p.es_principal
  where o.periodo_id = p_periodo_id
    and o.vehiculo_id is not null
  on conflict (prefactura_id, odt_id) do nothing;

  return query select v_creadas, v_actualizadas;
end;
$$;

comment on function public.generar_prefacturas_periodo(uuid) is
  'Botón "Generar prefacturas del período": vincula ODT huérfanas, hace UPSERT de 1 prefactura PRINCIPAL por vehículo con ODT en el período (no toca secundarias), congela prefactura_detalle. El correlativo solo se asigna a las nuevas.';

-- Las secundarias/ajuste no deben inflar los KPI del dashboard (monto
-- total, conteo por estado): representan una corrección puntual sobre una
-- prefactura que ya se cuenta, no facturación adicional del período.
create or replace function public.dashboard_indicadores(p_periodo_id uuid default null)
returns table (
  total_prefacturas bigint,
  prefacturas_borrador bigint,
  prefacturas_con_novedades bigint,
  prefacturas_listas bigint,
  prefacturas_pdf_generado bigint,
  prefacturas_en_cola_envio bigint,
  prefacturas_enviadas bigint,
  prefacturas_error_envio bigint,
  monto_total_prefacturado numeric,
  total_odt bigint,
  total_transportistas_activos bigint,
  total_vehiculos_activos bigint,
  novedades_abiertas_error bigint,
  novedades_abiertas_advertencia bigint,
  novedades_abiertas_info bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) as total_prefacturas,
    count(*) filter (where p.estado = 'BORRADOR') as prefacturas_borrador,
    count(*) filter (where p.estado = 'CON_NOVEDADES') as prefacturas_con_novedades,
    count(*) filter (where p.estado = 'LISTA') as prefacturas_listas,
    count(*) filter (where p.estado = 'PDF_GENERADO') as prefacturas_pdf_generado,
    count(*) filter (where p.estado = 'EN_COLA_ENVIO') as prefacturas_en_cola_envio,
    count(*) filter (where p.estado = 'ENVIADA') as prefacturas_enviadas,
    count(*) filter (where p.estado = 'ERROR_ENVIO') as prefacturas_error_envio,
    coalesce(sum(p.total), 0) as monto_total_prefacturado,
    (select count(*) from public.odt o where p_periodo_id is null or o.periodo_id = p_periodo_id) as total_odt,
    (select count(*) from public.transportista t where t.activo and t.deleted_at is null)
      as total_transportistas_activos,
    (select count(*) from public.vehiculo v where v.activo and v.deleted_at is null)
      as total_vehiculos_activos,
    (select count(*) from public.novedad n
       where n.estado = 'ABIERTA' and n.severidad = 'ERROR'
         and (p_periodo_id is null or n.periodo_id = p_periodo_id)) as novedades_abiertas_error,
    (select count(*) from public.novedad n
       where n.estado = 'ABIERTA' and n.severidad = 'ADVERTENCIA'
         and (p_periodo_id is null or n.periodo_id = p_periodo_id)) as novedades_abiertas_advertencia,
    (select count(*) from public.novedad n
       where n.estado = 'ABIERTA' and n.severidad = 'INFO'
         and (p_periodo_id is null or n.periodo_id = p_periodo_id)) as novedades_abiertas_info
  from public.prefactura p
  where (p_periodo_id is null or p.periodo_id = p_periodo_id)
    and p.es_principal;
$$;

comment on function public.dashboard_indicadores(uuid) is
  'Indicadores agregados del dashboard para un período (o globales si p_periodo_id es null). Cuenta solo prefacturas principales, no secundarias/ajuste.';

create or replace function public.dashboard_prefacturas_por_estado(p_periodo_id uuid)
returns table (estado public.estado_prefactura, cantidad bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.estado, count(*) as cantidad
  from public.prefactura p
  where (p_periodo_id is null or p.periodo_id = p_periodo_id)
    and p.es_principal
  group by p.estado
  order by p.estado;
$$;

comment on function public.dashboard_prefacturas_por_estado(uuid) is
  'Cantidad de prefacturas principales por estado en un período, para el gráfico de avance de envío (no incluye secundarias/ajuste).';
