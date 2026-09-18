-- Triggers de negocio: auditoría genérica y numeración de prefactura sin
-- huecos bajo concurrencia.

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registro_id uuid;
begin
  v_registro_id := coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null);

  insert into public.auditoria (usuario, accion, tabla, registro_id, antes, despues)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    v_registro_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

comment on function public.registrar_auditoria() is
  'Trigger AFTER INSERT/UPDATE/DELETE: registra el cambio en `auditoria`. Solo se aplica a tablas sensibles (ver CREATE TRIGGER abajo).';

create trigger auditoria_odt after insert or update or delete on public.odt
  for each row execute function public.registrar_auditoria();
create trigger auditoria_prefactura after insert or update or delete on public.prefactura
  for each row execute function public.registrar_auditoria();
create trigger auditoria_documento_pdf after insert or update or delete on public.documento_pdf
  for each row execute function public.registrar_auditoria();
create trigger auditoria_envio_correo after insert or update or delete on public.envio_correo
  for each row execute function public.registrar_auditoria();
create trigger auditoria_vehiculo after insert or update or delete on public.vehiculo
  for each row execute function public.registrar_auditoria();
create trigger auditoria_transportista after insert or update or delete on public.transportista
  for each row execute function public.registrar_auditoria();
create trigger auditoria_perfil_usuario after insert or update or delete on public.perfil_usuario
  for each row execute function public.registrar_auditoria();
create trigger auditoria_configuracion after insert or update or delete on public.configuracion
  for each row execute function public.registrar_auditoria();

-- Correlativo sin huecos: una sola sentencia UPDATE atómica (toma el lock
-- de la fila del año, incrementa y devuelve en la misma operación) evita la
-- condición de carrera de "leer, sumar 1, escribir" en dos transacciones
-- concurrentes.
create or replace function public.siguiente_correlativo(p_anio integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secuencia integer;
begin
  insert into public.correlativo (anio, secuencia)
  values (p_anio, 1)
  on conflict (anio) do update set secuencia = public.correlativo.secuencia + 1
  returning secuencia into v_secuencia;

  return v_secuencia;
end;
$$;

comment on function public.siguiente_correlativo(integer) is
  'Devuelve el siguiente número de secuencia para el año dado, sin huecos bajo concurrencia (INSERT ... ON CONFLICT DO UPDATE es atómico).';

-- Asigna `numero` a una prefactura nueva con el formato de
-- config/app.config.ts (numeracion.formato = "PF-{AÑO}-{SECUENCIA}",
-- digitosSecuencia = 6 por defecto). Si existe un override en
-- `configuracion` (clave='numeracion'), se usa ese formato/dígitos.
create or replace function public.asignar_numero_prefactura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio integer;
  v_secuencia integer;
  v_formato text := 'PF-{AÑO}-{SECUENCIA}';
  v_digitos integer := 6;
  v_config jsonb;
begin
  if new.numero is not null then
    return new;
  end if;

  select valor into v_config from public.configuracion where clave = 'numeracion';
  if v_config is not null then
    v_formato := coalesce(v_config ->> 'formato', v_formato);
    v_digitos := coalesce((v_config ->> 'digitosSecuencia')::integer, v_digitos);
  end if;

  v_anio := extract(year from now());
  v_secuencia := public.siguiente_correlativo(v_anio);

  new.numero := replace(
    replace(v_formato, '{AÑO}', v_anio::text),
    '{SECUENCIA}',
    lpad(v_secuencia::text, v_digitos, '0')
  );

  return new;
end;
$$;

create trigger prefactura_asignar_numero
  before insert on public.prefactura
  for each row execute function public.asignar_numero_prefactura();

comment on function public.asignar_numero_prefactura() is
  'BEFORE INSERT en prefactura: asigna el correlativo formateado si numero es null. Una vez emitido, numero nunca se reasigna (corregir crea una nueva versión de documento_pdf).';
