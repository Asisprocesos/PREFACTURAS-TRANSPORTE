-- Dashboard: indicadores agregados y series para los gráficos (monto por
-- centro de costo, monto por regional, top 10 placas, avance de envío).
--
-- Son funciones, no vistas, porque reciben el período como parámetro.
-- `security invoker` (el default, explícito) para que la RLS de las tablas
-- base siga aplicando según el rol de quien consulta: cualquier perfil
-- autenticado puede ver el dashboard, pero los números siempre se calculan
-- con los mismos filtros que vería en las pantallas de detalle.
--
-- p_periodo_id acepta null para totales globales (usado por indicadores que
-- no están atados a un período, como transportistas/vehículos activos); en
-- la UI del dashboard siempre se invoca con el período seleccionado.

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
  where p_periodo_id is null or p.periodo_id = p_periodo_id;
$$;

comment on function public.dashboard_indicadores(uuid) is
  'Indicadores agregados del dashboard para un período (o globales si p_periodo_id es null).';

create or replace function public.dashboard_prefacturas_por_estado(p_periodo_id uuid)
returns table (estado public.estado_prefactura, cantidad bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.estado, count(*) as cantidad
  from public.prefactura p
  where p_periodo_id is null or p.periodo_id = p_periodo_id
  group by p.estado
  order by p.estado;
$$;

comment on function public.dashboard_prefacturas_por_estado(uuid) is
  'Cantidad de prefacturas por estado en un período, para el gráfico de avance de envío.';

create or replace function public.dashboard_monto_por_centro_costo(p_periodo_id uuid, p_limite integer default 12)
returns table (centro_costo text, monto numeric, cantidad bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(o.centro_costo_final, 'SIN CENTRO DE COSTO') as centro_costo,
    coalesce(sum(o.valor_final), 0) as monto,
    count(*) as cantidad
  from public.odt o
  where p_periodo_id is null or o.periodo_id = p_periodo_id
  group by coalesce(o.centro_costo_final, 'SIN CENTRO DE COSTO')
  order by monto desc
  limit p_limite;
$$;

comment on function public.dashboard_monto_por_centro_costo(uuid, integer) is
  'Monto facturado por centro de costo final en un período, top p_limite ordenado descendente.';

create or replace function public.dashboard_monto_por_regional(p_periodo_id uuid)
returns table (regional text, monto numeric, cantidad bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(r.nombre, o.regional_origen_texto, 'SIN REGIONAL') as regional,
    coalesce(sum(o.valor_final), 0) as monto,
    count(*) as cantidad
  from public.odt o
  left join public.regional r on r.id = o.regional_origen_id
  where p_periodo_id is null or o.periodo_id = p_periodo_id
  group by coalesce(r.nombre, o.regional_origen_texto, 'SIN REGIONAL')
  order by monto desc;
$$;

comment on function public.dashboard_monto_por_regional(uuid) is
  'Monto facturado por regional de origen en un período.';

create or replace function public.dashboard_top_placas(p_periodo_id uuid, p_limite integer default 10)
returns table (placa text, transportista text, monto numeric, cantidad bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(o.placa_normalizada, 'SIN PLACA') as placa,
    max(t.razon_social) as transportista,
    coalesce(sum(o.valor_final), 0) as monto,
    count(*) as cantidad
  from public.odt o
  left join public.vehiculo v on v.id = o.vehiculo_id
  left join public.transportista t on t.id = v.transportista_id
  where p_periodo_id is null or o.periodo_id = p_periodo_id
  group by coalesce(o.placa_normalizada, 'SIN PLACA')
  order by monto desc
  limit p_limite;
$$;

comment on function public.dashboard_top_placas(uuid, integer) is
  'Top p_limite placas por monto facturado en un período.';
