-- "Actualizar existentes" al importar: cuando se vuelve a cargar un corte con datos corregidos de ODT que ya se habían importado antes, en vez de omitirlas por "guía duplicada" se pueden actualizar con los valores nuevos del archivo. Solo ADMIN (lo exige validar-action.ts) porque sobrescribe datos que ya pueden alimentar una prefactura enviada.
alter type public.decision_fila add value if not exists 'ACTUALIZAR';
alter table public.importacion add column if not exists actualizar_existentes boolean not null default false;
comment on column public.importacion.actualizar_existentes is 'Si estaba activada la casilla "Actualizar existentes" al validar: una guía ya existente se actualiza con los datos del archivo (decision=ACTUALIZAR) en vez de omitirse por duplicada. Se guarda para que la revalidación de una fila puntual (corregirFilaImportacionAction) use el mismo criterio.';
alter table public.importacion_fila add column if not exists procesada boolean not null default false;
comment on column public.importacion_fila.procesada is 'true una vez que confirmar_importacion_lote ya insertó (INSERTAR) o actualizó (ACTUALIZAR) esta fila. Reemplaza el chequeo anterior ("ya existe en odt para esta importación") porque no sirve para detectar un ACTUALIZAR ya procesado: esa guía pertenece a OTRA importación, nunca a esta.';

drop function if exists public.confirmar_importacion_lote(uuid, integer);

create or replace function public.confirmar_importacion_lote(
  p_importacion_id uuid,
  p_tamano_lote integer default 300
)
returns table (
  odt_insertadas integer,
  odt_actualizadas integer,
  novedades_generadas integer,
  filas_restantes integer,
  guias_actualizadas text[]
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_periodo_id uuid;
  v_odt_insertadas integer := 0;
  v_odt_actualizadas integer := 0;
  v_novedad_count integer := 0;
  v_novedad_count_2 integer := 0;
  v_restantes integer := 0;
  v_fila_ids_insertar uuid[];
  v_fila_ids_actualizar uuid[];
  v_guias_actualizadas text[];
begin
  set local statement_timeout = '2min';

  select periodo_id into v_periodo_id from public.importacion where id = p_importacion_id;
  if v_periodo_id is null then
    raise exception 'La importación no tiene período asignado; valida antes de confirmar.';
  end if;

  -- ---- INSERTAR: igual que antes, solo que ahora "ya procesada" se marca
  -- con la columna `procesada` en vez de inferirla de si ya existe en `odt`
  -- (necesario para que el mismo criterio sirva también para ACTUALIZAR).
  select array_agg(x.id) into v_fila_ids_insertar
  from (
    select r.id
    from public.importacion_fila r
    where r.importacion_id = p_importacion_id
      and r.decision = 'INSERTAR'
      and not r.procesada
    order by r.numero_fila
    limit greatest(p_tamano_lote, 1)
  ) x;

  if v_fila_ids_insertar is not null then
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
    where r.id = any(v_fila_ids_insertar);

    get diagnostics v_odt_insertadas = row_count;

    update public.importacion_fila set procesada = true where id = any(v_fila_ids_insertar);

    insert into public.novedad (tipo, severidad, entidad, entidad_id, placa, guia, periodo_id, mensaje)
    select
      'IMPORTACION', 'ADVERTENCIA', 'odt', o.id, o.placa_normalizada, o.guia, v_periodo_id, adv.value #>> '{}'
    from public.importacion_fila r
    join public.odt o
      on o.importacion_id = p_importacion_id
     and o.guia = r.datos_normalizados ->> 'guia'
    cross join lateral jsonb_array_elements(r.advertencias) as adv(value)
    where r.id = any(v_fila_ids_insertar)
      and jsonb_array_length(r.advertencias) > 0;

    get diagnostics v_novedad_count = row_count;

    insert into public.log_ejecucion (ejecucion_id, guia, etapa, estado, detalle)
    select
      p_importacion_id, r.datos_normalizados ->> 'guia', 'IMPORTACION', 'OK', jsonb_build_object('fila', r.numero_fila)
    from public.importacion_fila r
    where r.id = any(v_fila_ids_insertar);
  end if;

  -- ---- ACTUALIZAR: la guía ya existe en `odt` (de otra importación, casi
  -- siempre) — se actualizan sus campos con los valores de este archivo en
  -- vez de insertar una fila nueva. No se toca importacion_id/created_by (se
  -- conserva la procedencia original de la ODT); valor_final se resetea a
  -- valor, igual que en una fila nueva, porque el archivo trae el dato
  -- corregido desde el origen — aunque eso pise una corrección manual previa
  -- hecha desde /odt/{guia}/corregir.
  select array_agg(x.id) into v_fila_ids_actualizar
  from (
    select r.id
    from public.importacion_fila r
    where r.importacion_id = p_importacion_id
      and r.decision = 'ACTUALIZAR'
      and not r.procesada
    order by r.numero_fila
    limit greatest(p_tamano_lote, 1)
  ) x;

  if v_fila_ids_actualizar is not null then
    with actualizadas as (
      update public.odt o set
        placa_original = r.datos_normalizados ->> 'placaOriginal',
        placa_normalizada = r.datos_normalizados ->> 'placaNormalizada',
        vehiculo_id = v.id,
        chofer = r.datos_normalizados ->> 'chofer',
        ruta = r.datos_normalizados ->> 'ruta',
        ruta_zona = r.datos_normalizados ->> 'rutaZona',
        detalle_ruta = r.datos_normalizados ->> 'detalleRuta',
        regional_origen_texto = r.datos_normalizados ->> 'regionalOrigenTexto',
        regional_destino_texto = r.datos_normalizados ->> 'regionalDestinoTexto',
        estado_fenix = r.datos_normalizados ->> 'estadoFenix',
        fecha_recepcion = nullif(r.datos_normalizados ->> 'fechaRecepcion', '')::date,
        fecha_creacion = (r.datos_normalizados ->> 'fechaCreacion')::date,
        usuario_fenix = r.datos_normalizados ->> 'usuarioFenix',
        valor = (r.datos_normalizados ->> 'valor')::numeric,
        valor_final = (r.datos_normalizados ->> 'valor')::numeric,
        tipo_costo = r.datos_normalizados ->> 'tipoCosto',
        tipo_ruta = r.datos_normalizados ->> 'tipoRuta',
        centro_costo_final = t.centro_costo
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
      where r.id = any(v_fila_ids_actualizar)
        and o.guia = r.datos_normalizados ->> 'guia'
      returning o.guia
    )
    -- Se cuenta/agrega acá en vez de con GET DIAGNOSTICS: en un UPDATE
    -- dentro de un WITH, GET DIAGNOSTICS ROW_COUNT después de un SELECT
    -- final reporta las filas de ESE SELECT (siempre 1, por el agregado),
    -- no las que realmente actualizó el UPDATE.
    select count(*), array_agg(distinct guia) into v_odt_actualizadas, v_guias_actualizadas from actualizadas;

    update public.importacion_fila set procesada = true where id = any(v_fila_ids_actualizar);

    insert into public.novedad (tipo, severidad, entidad, entidad_id, placa, guia, periodo_id, mensaje)
    select
      'IMPORTACION', 'ADVERTENCIA', 'odt', o.id, o.placa_normalizada, o.guia, v_periodo_id, adv.value #>> '{}'
    from public.importacion_fila r
    join public.odt o on o.guia = r.datos_normalizados ->> 'guia'
    cross join lateral jsonb_array_elements(r.advertencias) as adv(value)
    where r.id = any(v_fila_ids_actualizar)
      and jsonb_array_length(r.advertencias) > 0;

    get diagnostics v_novedad_count_2 = row_count;

    insert into public.log_ejecucion (ejecucion_id, guia, etapa, estado, detalle)
    select
      p_importacion_id, r.datos_normalizados ->> 'guia', 'IMPORTACION', 'OK',
      jsonb_build_object('fila', r.numero_fila, 'actualizada', true)
    from public.importacion_fila r
    where r.id = any(v_fila_ids_actualizar);
  end if;

  select count(*) into v_restantes
  from public.importacion_fila r
  where r.importacion_id = p_importacion_id
    and r.decision in ('INSERTAR', 'ACTUALIZAR')
    and not r.procesada;

  if v_restantes = 0 then
    update public.importacion set estado = 'CONFIRMADA' where id = p_importacion_id;
  end if;

  return query select
    v_odt_insertadas, v_odt_actualizadas, v_novedad_count + v_novedad_count_2, v_restantes, v_guias_actualizadas;
end;
$$;

comment on function public.confirmar_importacion_lote(uuid, integer) is
  'Confirma hasta p_tamano_lote filas pendientes (decision IN (INSERTAR, ACTUALIZAR) AND NOT procesada) por llamada: INSERTAR crea la ODT, ACTUALIZAR sobrescribe la ODT existente (misma guía, de otra importación) con los valores del archivo. Genera novedad/log_ejecucion para ambos casos, y marca la importación CONFIRMADA cuando ya no quedan filas pendientes. Idempotente (reintentar nunca duplica ni reprocesa). El cliente la llama en un ciclo hasta que filas_restantes sea 0, y usa guias_actualizadas de cada vuelta para marcar REQUIERE_REGENERAR en las prefacturas afectadas.';
