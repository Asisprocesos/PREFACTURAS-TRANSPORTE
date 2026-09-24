-- El rewrite set-based de confirmar_importacion (migración anterior) bajó
-- el trabajo real de miles de sentencias a un puñado de INSERT...SELECT,
-- pero el "canceling statement due to statement timeout" persiste según lo
-- reportado — lo que apunta a que el límite lo impone el statement_timeout
-- configurado a nivel de rol en Supabase (independiente de cuánto tarde la
-- consulta en sí). `SET LOCAL` sube ese límite SOLO para la transacción de
-- esta llamada RPC puntual (revierte solo al terminar, no afecta ninguna
-- otra sesión ni consulta del resto de la app) — cualquier rol puede
-- ajustar su propio statement_timeout, no requiere privilegios especiales.
-- Se aplica también a revertir_importacion por si un período con muchas
-- ODT choca con el mismo límite al deshacer una importación.

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
begin
  set local statement_timeout = '5min';

  select periodo_id into v_periodo_id from public.importacion where id = p_importacion_id;
  if v_periodo_id is null then
    raise exception 'La importación no tiene período asignado; valida antes de confirmar.';
  end if;

  insert into public.odt (
    guia, importacion_id, periodo_id, vehiculo_id,
    placa_original, placa_normalizada, chofer, ruta, ruta_zona, detalle_ruta,
    regional_origen_texto, regional_destino_texto,
    estado_fenix, fecha_recepcion, fecha_creacion, usuario_fenix,
    valor, valor_final, tipo_costo, tipo_ruta, centro_costo_final, corregida, created_by
  )
  select
    r.datos_normalizados ->> 'guia',
    p_importacion_id,
    v_periodo_id,
    v.id,
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
    t.centro_costo,
    coalesce((r.datos_normalizados ->> 'corregida')::boolean, false),
    auth.uid()
  from public.importacion_fila r
  left join public.vehiculo v
    on v.placa = r.datos_normalizados ->> 'placaNormalizada'
   and v.deleted_at is null
  left join lateral (
    select tc.centro_costo
    from public.tipo_ruta_centro_costo tc
    where lower(tc.tipo_ruta) = lower(r.datos_normalizados ->> 'tipoRuta')
      and tc.activo
      and tc.deleted_at is null
    limit 1
  ) t on true
  where r.importacion_id = p_importacion_id
    and r.decision = 'INSERTAR';

  get diagnostics v_odt_count = row_count;

  insert into public.novedad (tipo, severidad, entidad, entidad_id, placa, guia, periodo_id, mensaje)
  select
    'IMPORTACION',
    'ADVERTENCIA',
    'odt',
    o.id,
    o.placa_normalizada,
    o.guia,
    v_periodo_id,
    adv.value #>> '{}'
  from public.odt o
  join public.importacion_fila r
    on r.importacion_id = p_importacion_id
   and r.datos_normalizados ->> 'guia' = o.guia
  cross join lateral jsonb_array_elements(r.advertencias) as adv(value)
  where o.importacion_id = p_importacion_id
    and jsonb_array_length(r.advertencias) > 0;

  get diagnostics v_novedad_count = row_count;

  insert into public.log_ejecucion (ejecucion_id, guia, etapa, estado, detalle)
  select
    p_importacion_id,
    r.datos_normalizados ->> 'guia',
    'IMPORTACION',
    'OK',
    jsonb_build_object('fila', r.numero_fila)
  from public.importacion_fila r
  where r.importacion_id = p_importacion_id
    and r.decision = 'INSERTAR';

  update public.importacion set estado = 'CONFIRMADA' where id = p_importacion_id;

  return query select v_odt_count, v_novedad_count;
end;
$$;

comment on function public.confirmar_importacion(uuid) is
  'Inserta en odt todas las filas de importacion_fila con decision=INSERTAR en un solo INSERT...SELECT masivo (con su centro_costo_final ya cruzado desde tipo_ruta_centro_costo), genera novedad por cada advertencia y log_ejecucion por ODT también en bloque, y marca la importación como CONFIRMADA. Todo en una sola transacción, con su propio statement_timeout ampliado (SET LOCAL) para no depender del límite por defecto del rol de la API.';

create or replace function public.revertir_importacion(p_importacion_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prefactura_ids uuid[];
begin
  set local statement_timeout = '5min';

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
  'Revierte una importación (borra sus ODT y su staging) mientras ninguna de sus prefacturas tenga un envío de correo en estado ENVIADO. Suelta primero prefactura_detalle y elimina por completo las prefacturas que quedan sin ninguna ODT. Statement_timeout ampliado (SET LOCAL) igual que confirmar_importacion.';
