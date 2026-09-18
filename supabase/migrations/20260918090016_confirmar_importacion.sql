-- Confirmación / reversión de una importación, en una sola transacción de
-- base de datos (PostgREST/supabase-js no soporta transacciones
-- multi-sentencia desde el cliente; por eso esto vive en una función
-- Postgres invocada vía RPC). `security invoker` (el default, explícito
-- aquí) para que se sigan aplicando las políticas RLS del usuario que
-- confirma, no privilegios elevados.

create or replace function public.confirmar_importacion(p_importacion_id uuid)
returns table (odt_insertadas integer, novedades_generadas integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_periodo_id uuid;
  v_odt_count integer := 0;
  v_novedad_count integer := 0;
  r record;
  v_odt_id uuid;
begin
  select periodo_id into v_periodo_id from public.importacion where id = p_importacion_id;
  if v_periodo_id is null then
    raise exception 'La importación no tiene período asignado; valida antes de confirmar.';
  end if;

  for r in
    select *
    from public.importacion_fila
    where importacion_id = p_importacion_id
      and decision = 'INSERTAR'
  loop
    insert into public.odt (
      guia, importacion_id, periodo_id, vehiculo_id,
      placa_original, placa_normalizada, chofer, ruta, ruta_zona, detalle_ruta,
      regional_origen_texto, regional_destino_texto,
      estado_fenix, fecha_recepcion, fecha_creacion, usuario_fenix,
      valor, valor_final, tipo_costo, tipo_ruta, corregida, created_by
    )
    values (
      r.datos_normalizados ->> 'guia',
      p_importacion_id,
      v_periodo_id,
      (select id from public.vehiculo where placa = r.datos_normalizados ->> 'placaNormalizada' limit 1),
      r.datos_normalizados ->> 'placaOriginal',
      r.datos_normalizados ->> 'placaNormalizada',
      r.datos_normalizados ->> 'chofer',
      r.datos_normalizados ->> 'ruta',
      r.datos_normalizados ->> 'rutaZona',
      r.datos_normalizados ->> 'detalleRuta',
      r.datos_normalizados ->> 'regionalOrigenTexto',
      r.datos_normalizados ->> 'regionalDestinoTexto',
      r.datos_normalizados ->> 'estadoFenix',
      nullif(r.datos_normalizados ->> 'fechaRecepcion', '')::date,
      (r.datos_normalizados ->> 'fechaCreacion')::date,
      r.datos_normalizados ->> 'usuarioFenix',
      (r.datos_normalizados ->> 'valor')::numeric,
      (r.datos_normalizados ->> 'valor')::numeric,
      r.datos_normalizados ->> 'tipoCosto',
      r.datos_normalizados ->> 'tipoRuta',
      coalesce((r.datos_normalizados ->> 'corregida')::boolean, false),
      auth.uid()
    )
    returning id into v_odt_id;

    v_odt_count := v_odt_count + 1;

    if jsonb_array_length(r.advertencias) > 0 then
      insert into public.novedad (tipo, severidad, entidad, entidad_id, placa, guia, periodo_id, mensaje)
      select
        'IMPORTACION',
        'ADVERTENCIA',
        'odt',
        v_odt_id,
        r.datos_normalizados ->> 'placaNormalizada',
        r.datos_normalizados ->> 'guia',
        v_periodo_id,
        adv.value #>> '{}'
      from jsonb_array_elements(r.advertencias) as adv(value);
      v_novedad_count := v_novedad_count + jsonb_array_length(r.advertencias);
    end if;

    insert into public.log_ejecucion (ejecucion_id, guia, etapa, estado, detalle)
    values (
      p_importacion_id,
      r.datos_normalizados ->> 'guia',
      'IMPORTACION',
      'OK',
      jsonb_build_object('fila', r.numero_fila)
    );
  end loop;

  update public.importacion set estado = 'CONFIRMADA' where id = p_importacion_id;

  return query select v_odt_count, v_novedad_count;
end;
$$;

comment on function public.confirmar_importacion(uuid) is
  'Inserta en odt todas las filas de importacion_fila con decision=INSERTAR, genera novedad por cada advertencia y log_ejecucion por ODT, y marca la importación como CONFIRMADA. Todo en una sola transacción.';

create or replace function public.revertir_importacion(p_importacion_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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

  delete from public.odt where importacion_id = p_importacion_id;
  delete from public.importacion_fila where importacion_id = p_importacion_id;
  update public.importacion set estado = 'REVERTIDA' where id = p_importacion_id;
end;
$$;

comment on function public.revertir_importacion(uuid) is
  'Revierte una importación (borra sus ODT y su staging) mientras ninguna de sus prefacturas tenga un envío de correo en estado ENVIADO.';
