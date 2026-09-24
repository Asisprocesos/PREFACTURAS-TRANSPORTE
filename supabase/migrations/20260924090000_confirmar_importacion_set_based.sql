-- confirmar_importacion() insertaba con un cursor (FOR ... LOOP) que hacía
-- 3-5 sentencias SQL por fila del staging; con archivos de varios miles de
-- filas esto se pasaba del statement_timeout del rol de la API ("canceling
-- statement due to statement timeout") y, como todo corre en una sola
-- función/transacción, nunca llegaba a insertar nada. Se reescribe como 3
-- INSERT...SELECT masivos (uno para odt, uno para novedad, uno para
-- log_ejecucion) en vez de un insert por fila — sigue siendo una sola
-- transacción (todo o nada, tal como ya se documenta en la UI), pero corre
-- órdenes de magnitud más rápido porque el motor procesa el lote entero de
-- una vez en vez de una sentencia PL/pgSQL a la vez.

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
  'Inserta en odt todas las filas de importacion_fila con decision=INSERTAR en un solo INSERT...SELECT masivo (con su centro_costo_final ya cruzado desde tipo_ruta_centro_costo), genera novedad por cada advertencia y log_ejecucion por ODT también en bloque, y marca la importación como CONFIRMADA. Todo en una sola transacción (reescrito desde un cursor fila-a-fila que no escalaba a miles de filas sin exceder el statement_timeout del rol de la API).';

-- Acelera el filtro por importación + decisión que usan tanto esta función
-- como el resto del módulo de importación (confirmar, listados de filas).
create index if not exists importacion_fila_importacion_decision_idx
  on public.importacion_fila (importacion_id, decision);
