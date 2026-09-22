-- revertir_importacion() borraba directo de `odt`, pero si el período ya
-- tuvo "Generar prefacturas" corrido (lo normal después de importar), esas
-- ODT están referenciadas desde `prefactura_detalle`
-- (prefactura_detalle_odt_id_fkey) y el DELETE fallaba con una violación de
-- llave foránea. Ahora primero suelta esa referencia, y limpia por completo
-- las prefacturas que se quedan sin ninguna ODT (de esta o de otra
-- importación) tras el revert; las que conservan ODT de otra importación
-- quedan con totales desactualizados hasta el próximo "Generar prefacturas
-- del período".

create or replace function public.revertir_importacion(p_importacion_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prefactura_ids uuid[];
begin
  if exists (
    select 1
    from public.odt o
    join public.prefactura_detalle pd on pd.odt_id = o.id
    join public.envio_correo ec on ec.prefactura_id = pd.prefactura_id and ec.estado = 'ENVIADO'
    where o.importacion_id = p_importacion_id
  ) then
    raise exception 'No se puede revertir: ya hay prefacturas de esta importación con PDF enviado.';
  end if;

  select array_agg(distinct pd.prefactura_id)
  into v_prefactura_ids
  from public.prefactura_detalle pd
  join public.odt o on o.id = pd.odt_id
  where o.importacion_id = p_importacion_id;

  delete from public.prefactura_detalle
  where odt_id in (select id from public.odt where importacion_id = p_importacion_id);

  if v_prefactura_ids is not null then
    -- envio_correo no tiene "on delete cascade" desde prefactura, así que
    -- hay que soltarlo a mano antes de borrar la prefactura; el guard de
    -- arriba ya garantiza que ninguno esté en estado ENVIADO.
    delete from public.envio_correo
    where prefactura_id = any(v_prefactura_ids)
      and not exists (
        select 1 from public.prefactura_detalle pd where pd.prefactura_id = envio_correo.prefactura_id
      );

    -- prefactura_detalle/documento_pdf/descuento/factura_transportista sí
    -- tienen "on delete cascade" desde prefactura, así que borrar la
    -- prefactura basta para limpiarlos.
    delete from public.prefactura p
    where p.id = any(v_prefactura_ids)
      and not exists (
        select 1 from public.prefactura_detalle pd where pd.prefactura_id = p.id
      );
  end if;

  delete from public.odt where importacion_id = p_importacion_id;
  delete from public.importacion_fila where importacion_id = p_importacion_id;
  update public.importacion set estado = 'REVERTIDA' where id = p_importacion_id;
end;
$$;

comment on function public.revertir_importacion(uuid) is
  'Revierte una importación (borra sus ODT y su staging) mientras ninguna de sus prefacturas tenga un envío de correo en estado ENVIADO. Suelta primero prefactura_detalle y elimina por completo las prefacturas que quedan sin ninguna ODT.';
