-- Si una ODT se importó antes de que su placa existiera en el catálogo de
-- Vehículos, queda con vehiculo_id null (ver "Placas sin vehículo" en
-- Reportes). Nada la vinculaba retroactivamente al registrar el vehículo
-- después, así que "Generar prefacturas del período" nunca la incluía —
-- aunque el vehículo ya estuviera cargado, la búsqueda por placa en
-- Validación ODT seguía diciendo "no hay prefactura". Ahora, antes de
-- agrupar, se vincula cualquier ODT del período que siga sin vehiculo_id
-- pero cuya placa ya coincida con un vehículo activo registrado.
--
-- Nota: los alias de una sola letra (o, v, p, a) van seguidos de la
-- siguiente palabra en la MISMA línea a propósito, en vez del salto de
-- línea habitual — el editor SQL de Supabase interpretaba mal un salto de
-- línea justo después de un alias corto y rompía el pegado del script.

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
  update odt o set vehiculo_id = v.id
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
    from odt o join vehiculo v on v.id = o.vehiculo_id
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
  from odt o join prefactura p on p.vehiculo_id = o.vehiculo_id and p.periodo_id = p_periodo_id
  where o.periodo_id = p_periodo_id
    and o.vehiculo_id is not null
  on conflict (prefactura_id, odt_id) do nothing;

  return query select v_creadas, v_actualizadas;
end;
$$;

comment on function public.generar_prefacturas_periodo(uuid) is
  'Botón "Generar prefacturas del período": vincula ODT huérfanas (placa registrada después de importar) y hace UPSERT de 1 prefactura por vehículo con ODT en el período, congela prefactura_detalle. El correlativo solo se asigna a las nuevas.';
