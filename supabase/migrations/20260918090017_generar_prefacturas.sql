-- Genera/actualiza (UPSERT) 1 prefactura por vehículo con ODT en el
-- período dado. El correlativo (`prefactura_asignar_numero`, ver
-- 20260918090012) solo se dispara en el INSERT, nunca en el UPDATE del
-- ON CONFLICT, así que las prefacturas existentes conservan su número.

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
    on conflict (vehiculo_id, periodo_id) do update
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

  -- Congela el detalle de ODT de cada prefactura del período.
  insert into prefactura_detalle (prefactura_id, odt_id)
  select p.id, o.id
  from odt o
  join prefactura p on p.vehiculo_id = o.vehiculo_id and p.periodo_id = p_periodo_id
  where o.periodo_id = p_periodo_id
    and o.vehiculo_id is not null
  on conflict (prefactura_id, odt_id) do nothing;

  return query select v_creadas, v_actualizadas;
end;
$$;

comment on function public.generar_prefacturas_periodo(uuid) is
  'Botón "Generar prefacturas del período": UPSERT 1 prefactura por vehículo con ODT en el período, congela prefactura_detalle. El correlativo solo se asigna a las nuevas.';
