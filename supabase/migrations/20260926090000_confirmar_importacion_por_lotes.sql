-- El statement_timeout se amplió tanto dentro de la función (SET LOCAL)
-- como a nivel de rol (alter role authenticated/anon) y el error
-- "canceling statement due to statement timeout" seguía apareciendo en
-- archivos grandes — indica que hay algo en la infraestructura del
-- proyecto de Supabase que no se está logrando ajustar por SQL. En vez de
-- seguir dependiendo de subir un límite que no responde, se reemplaza la
-- confirmación de una sola vez por una versión por lotes: el cliente llama
-- esta función repetidas veces (un lote chico por llamada) hasta que no
-- queden filas pendientes, mostrando el avance entre cada llamada — mismo
-- patrón que ya se usó para la carga masiva de Transportistas/Vehículos.
--
-- Es idempotente por construcción: cada lote solo toma filas cuya guía
-- todavía no existe en `odt` para esta importación, así que reintentar un
-- lote que falló a mitad de camino (o repetir la llamada completa) nunca
-- duplica nada.
--
-- Reemplaza a confirmar_importacion(uuid), que se elimina: ya no queda
-- ningún llamador (el cliente ahora siempre usa la versión por lotes,
-- incluso para archivos chicos, donde basta una sola vuelta del ciclo).

drop function if exists public.confirmar_importacion(uuid);

create or replace function public.confirmar_importacion_lote(
  p_importacion_id uuid,
  p_tamano_lote integer default 300
)
returns table (odt_insertadas integer, novedades_generadas integer, filas_restantes integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_periodo_id uuid;
  v_odt_count integer := 0;
  v_novedad_count integer := 0;
  v_restantes integer := 0;
  v_fila_ids uuid[];
begin
  set local statement_timeout = '2min';

  select periodo_id into v_periodo_id from public.importacion where id = p_importacion_id;
  if v_periodo_id is null then
    raise exception 'La importación no tiene período asignado; valida antes de confirmar.';
  end if;

  select array_agg(x.id) into v_fila_ids
  from (
    select r.id
    from public.importacion_fila r
    where r.importacion_id = p_importacion_id
      and r.decision = 'INSERTAR'
      and not exists (
        select 1 from public.odt o
        where o.importacion_id = p_importacion_id
          and o.guia = r.datos_normalizados ->> 'guia'
      )
    order by r.numero_fila
    limit greatest(p_tamano_lote, 1)
  ) x;

  if v_fila_ids is not null then
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
    where r.id = any(v_fila_ids);

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
    from public.importacion_fila r
    join public.odt o
      on o.importacion_id = p_importacion_id
     and o.guia = r.datos_normalizados ->> 'guia'
    cross join lateral jsonb_array_elements(r.advertencias) as adv(value)
    where r.id = any(v_fila_ids)
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
    where r.id = any(v_fila_ids);
  end if;

  select count(*) into v_restantes
  from public.importacion_fila r
  where r.importacion_id = p_importacion_id
    and r.decision = 'INSERTAR'
    and not exists (
      select 1 from public.odt o
      where o.importacion_id = p_importacion_id
        and o.guia = r.datos_normalizados ->> 'guia'
    );

  if v_restantes = 0 then
    update public.importacion set estado = 'CONFIRMADA' where id = p_importacion_id;
  end if;

  return query select v_odt_count, v_novedad_count, v_restantes;
end;
$$;

comment on function public.confirmar_importacion_lote(uuid, integer) is
  'Inserta en odt hasta p_tamano_lote filas de importacion_fila con decision=INSERTAR que todavía no tengan su guía en odt (idempotente: reintentar nunca duplica), genera novedad/log_ejecucion para ese lote, y marca la importación CONFIRMADA cuando ya no quedan filas pendientes. El cliente la llama en un ciclo hasta que filas_restantes sea 0.';
