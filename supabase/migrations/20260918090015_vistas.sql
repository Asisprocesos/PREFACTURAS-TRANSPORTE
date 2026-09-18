-- Vistas y funciones de consulta agregada.
--
-- `security_invoker = true` en cada vista es obligatorio: sin esto, Postgres
-- ejecuta la vista con los permisos de quien la creó (el rol de las
-- migraciones), no del usuario que consulta, y la RLS de las tablas base
-- quedaría sin efecto para cualquiera que lea la vista.

-- Página 2 del PDF de prefactura y pantalla "Validación ODT": resumen por
-- centro de costo final x regional x ruta macro (réplica de TD FACTURA /
-- la matriz RESUMEN CENTRO DE COSTO x REGIONAL).
create view public.v_resumen_facturacion
with (security_invoker = true) as
select
  pd.prefactura_id,
  o.centro_costo_final,
  coalesce(ro.nombre, o.regional_origen_texto, 'SIN REGIONAL') as regional,
  o.ruta_macro,
  count(*) as cantidad,
  sum(o.valor_final) as suma,
  case when count(*) > 0 then round(sum(o.valor_final) / count(*), 2) else 0 end as valor_unitario_promedio
from public.prefactura_detalle pd
join public.odt o on o.id = pd.odt_id
left join public.regional ro on ro.id = o.regional_origen_id
group by pd.prefactura_id, o.centro_costo_final, coalesce(ro.nombre, o.regional_origen_texto, 'SIN REGIONAL'), o.ruta_macro;

comment on view public.v_resumen_facturacion is
  'Resumen CENTRO DE COSTO FINAL x REGIONAL x RUTA por prefactura (réplica de la hoja TD FACTURA), usado en la página 2 del PDF y en Validación ODT.';

-- Total general por prefactura (fila "Total general" de TD FACTURA).
create view public.v_total_facturacion
with (security_invoker = true) as
select prefactura_id, sum(suma) as total_general
from public.v_resumen_facturacion
group by prefactura_id;

comment on view public.v_total_facturacion is 'Total general por prefactura, a partir de v_resumen_facturacion.';

-- Match comparativo de escaneo de ODT físicas (submódulo de Validación ODT):
-- ESCANEADA_Y_CARGADA, ESCANEADA_NO_CARGADA, CARGADA_SIN_FISICA,
-- OTRA_PLACA_O_PERIODO. Es una función (no una vista) porque el resultado
-- depende de la sesión de escaneo consultada.
create or replace function public.match_escaneo(p_sesion_id uuid)
returns table (guia text, resultado text, odt_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  with sesion as (
    select * from public.sesion_escaneo where id = p_sesion_id
  ),
  escaneos as (
    select distinct guia_escaneada as guia from public.escaneo_odt where sesion_id = p_sesion_id
  ),
  esperadas as (
    select o.id, o.guia
    from public.odt o, sesion s
    where o.periodo_id = s.periodo_id
      and (s.placa is null or o.placa_normalizada = s.placa)
  )
  select e.guia, 'ESCANEADA_Y_CARGADA', esp.id
  from escaneos e
  join esperadas esp on esp.guia = e.guia

  union all

  select e.guia, 'ESCANEADA_NO_CARGADA', null::uuid
  from escaneos e
  where not exists (select 1 from public.odt o where o.guia = e.guia)

  union all

  select e.guia, 'OTRA_PLACA_O_PERIODO', o.id
  from escaneos e
  join public.odt o on o.guia = e.guia
  where not exists (select 1 from esperadas esp where esp.guia = e.guia)

  union all

  select esp.guia, 'CARGADA_SIN_FISICA', esp.id
  from esperadas esp
  where not exists (select 1 from escaneos e where e.guia = esp.guia);
$$;

comment on function public.match_escaneo(uuid) is
  'Match comparativo escaneo físico vs. sistema para una sesión de escaneo. Ver módulo Validación ODT / Escaneo.';
