-- Programa pg_cron + pg_net para disparar /api/jobs/email cada minuto.
--
-- Requiere, ANTES de que este bloque tenga efecto real:
--   1. Habilitar las extensiones pg_cron y pg_net (Database → Extensions
--      en Supabase Studio, o `create extension pg_cron; create extension
--      pg_net;` con un rol con privilegios suficientes — supabase_admin).
--   2. Configurar la URL pública de despliegue y el secreto compartido:
--        alter database postgres set app.settings.cron_url = 'https://tu-dominio.vercel.app';
--        alter database postgres set app.settings.cron_secret = 'el-mismo-valor-que-CRON_SECRET-en-Vercel';
--
-- Si las extensiones no están habilitadas todavía, este bloque no falla:
-- registra un aviso (`raise notice`) y no programa nada. Vuelve a correr
-- este mismo bloque a mano (psql o SQL Editor de Supabase Studio) después
-- de cumplir los dos requisitos de arriba. Ver README.md, sección pg_cron.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    if exists (select 1 from cron.job where jobname = 'procesar-envio-correo') then
      perform cron.unschedule('procesar-envio-correo');
    end if;

    perform cron.schedule(
      'procesar-envio-correo',
      '* * * * *',
      $cron$
        select net.http_post(
          url := current_setting('app.settings.cron_url', true) || '/api/jobs/email',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true),
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  else
    raise notice 'pg_cron/pg_net no están habilitados: el job procesar-envio-correo no se programó. Ver README.md, sección pg_cron.';
  end if;
end $$;
