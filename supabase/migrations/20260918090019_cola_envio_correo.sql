-- Cola de envío de correo: reclamo atómico de filas con
-- FOR UPDATE SKIP LOCKED. PostgREST/supabase-js no puede expresar
-- "SELECT ... FOR UPDATE SKIP LOCKED" directo, así que vive en una función
-- que hace el SELECT+UPDATE en una sola sentencia.
--
-- SECURITY DEFINER porque el worker (/api/jobs/email) llama a esta función
-- con el cliente admin (service_role) protegido por CRON_SECRET a nivel de
-- aplicación, no con la sesión de un usuario; conceptualmente equivalente a
-- las demás funciones de cola de este esquema.

create or replace function public.tomar_lote_envio_correo(p_limite integer)
returns setof public.envio_correo
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.envio_correo
  set estado = 'ENVIANDO'
  where id in (
    select id
    from public.envio_correo
    where estado in ('PENDIENTE', 'REINTENTAR')
      and (proximo_intento is null or proximo_intento <= now())
    order by created_at
    limit p_limite
    for update skip locked
  )
  returning *;
end;
$$;

comment on function public.tomar_lote_envio_correo(integer) is
  'Reclama hasta p_limite filas de envio_correo listas para procesar (PENDIENTE/REINTENTAR con proximo_intento vencido), las marca ENVIANDO y las devuelve. Usado por /api/jobs/email.';
