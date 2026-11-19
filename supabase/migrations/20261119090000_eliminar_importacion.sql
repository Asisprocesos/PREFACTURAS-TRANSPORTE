-- "Eliminar importación" (distinto de "Revertir importación"): revertir deja
-- el registro en `importacion` con estado REVERTIDA — como hash_sha256 es
-- único, re-subir exactamente el mismo archivo lo detecta como "ya existía"
-- y lo manda de vuelta a esa importación REVERTIDA, que no tiene ningún paso
-- siguiente en la pantalla (no es BORRADOR/VALIDADA/CONFIRMADA) — un
-- callejón sin salida. eliminar_importacion hace lo mismo que revertir (ODT,
-- prefacturas que se quedan sin ninguna ODT, envíos sueltos) y además borra
-- las novedades que esa importación generó y la fila de `importacion` misma,
-- para que un reintento con el mismo archivo cree un registro nuevo y limpio.
-- El archivo en Storage se borra aparte, desde el Server Action
-- (eliminarImportacionAction en confirmar-action.ts): Storage no es
-- manejable desde una función SQL.
-- Cada sentencia está en UNA sola línea a propósito (ver migraciones
-- anteriores): el editor/proceso que corre esto ejecuta línea por línea.
create or replace function public.eliminar_importacion(p_importacion_id uuid) returns void language plpgsql security invoker set search_path = public as $$ declare v_prefactura_ids uuid[]; begin if exists (select 1 from public.odt o join public.prefactura_detalle pd on pd.odt_id = o.id join public.envio_correo ec on ec.prefactura_id = pd.prefactura_id and ec.estado = 'ENVIADO' where o.importacion_id = p_importacion_id) then raise exception 'No se puede eliminar: ya hay prefacturas de esta importación con PDF enviado.'; end if; select array_agg(distinct pd.prefactura_id) into v_prefactura_ids from public.prefactura_detalle pd join public.odt o on o.id = pd.odt_id where o.importacion_id = p_importacion_id; delete from public.prefactura_detalle where odt_id in (select id from public.odt where importacion_id = p_importacion_id); if v_prefactura_ids is not null then delete from public.envio_correo where prefactura_id = any(v_prefactura_ids) and not exists (select 1 from public.prefactura_detalle pd where pd.prefactura_id = envio_correo.prefactura_id); delete from public.prefactura p where p.id = any(v_prefactura_ids) and not exists (select 1 from public.prefactura_detalle pd where pd.prefactura_id = p.id); end if; delete from public.novedad where entidad = 'odt' and entidad_id in (select id from public.odt where importacion_id = p_importacion_id); delete from public.odt where importacion_id = p_importacion_id; delete from public.importacion where id = p_importacion_id; end; $$;
comment on function public.eliminar_importacion(uuid) is 'Elimina POR COMPLETO una importación: ODT, prefacturas que se quedan sin ninguna ODT, envíos sueltos, novedades asociadas, su staging (importacion_fila, on delete cascade) y la fila de importacion misma — a diferencia de revertir_importacion, que solo la revierte y conserva el registro (quedando como un callejón sin salida si se re-sube el mismo archivo). Bloquea igual que revertir si ya hay un envío ENVIADO. El archivo en Storage se borra aparte, desde eliminarImportacionAction.';
