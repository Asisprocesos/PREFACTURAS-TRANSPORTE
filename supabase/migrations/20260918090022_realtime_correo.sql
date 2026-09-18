-- Habilita Supabase Realtime (postgres_changes) para las tablas que la
-- pantalla de progreso de envío masivo escucha. Sin esto, la suscripción
-- del cliente (`supabase.channel(...).on('postgres_changes', ...)`) no
-- recibe ningún evento aunque las filas sí cambien.
--
-- Envuelto en un DO block porque `alter publication ... add table` falla
-- si la tabla ya es miembro (por ejemplo, si Supabase ya publica todo el
-- esquema por defecto en este proyecto) o si la publicación
-- `supabase_realtime` todavía no existe en este entorno.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lote_proceso'
    ) then
      alter publication supabase_realtime add table public.lote_proceso;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'envio_correo'
    ) then
      alter publication supabase_realtime add table public.envio_correo;
    end if;
  else
    raise notice 'La publicación supabase_realtime no existe en este entorno; habilítala manualmente en Database → Replication.';
  end if;
end $$;
