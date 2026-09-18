-- Incrementa atómicamente exitosos/fallidos de un lote_proceso y, cuando
-- se completa, actualiza su estado. Atómico porque el worker de correo
-- puede correr disparado por pg_cron y por el frontend casi al mismo
-- tiempo; dos UPDATE ... SET x = x + 1 concurrentes son seguros en
-- Postgres (cada uno toma el lock de fila), pero un "leer, sumar, escribir"
-- hecho en el cliente no lo sería.

create or replace function public.incrementar_progreso_lote(p_lote_id uuid, p_exitoso boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exitosos integer;
  v_fallidos integer;
  v_total integer;
begin
  if p_exitoso then
    update public.lote_proceso set exitosos = exitosos + 1, estado = 'PROCESANDO' where id = p_lote_id;
  else
    update public.lote_proceso set fallidos = fallidos + 1, estado = 'PROCESANDO' where id = p_lote_id;
  end if;

  select exitosos, fallidos, total into v_exitosos, v_fallidos, v_total
  from public.lote_proceso where id = p_lote_id;

  if v_exitosos + v_fallidos >= v_total then
    update public.lote_proceso
    set estado = case when v_fallidos > 0 then 'COMPLETADO_CON_ERRORES' else 'COMPLETADO' end
    where id = p_lote_id;
  end if;
end;
$$;

comment on function public.incrementar_progreso_lote(uuid, boolean) is
  'Incrementa exitosos/fallidos de un lote_proceso de forma atómica y lo marca COMPLETADO/COMPLETADO_CON_ERRORES cuando termina. Usado por /api/jobs/email.';
