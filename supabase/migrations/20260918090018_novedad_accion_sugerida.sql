-- Reemplaza confirmar_importacion para poblar `novedad.accion_sugerida`
-- según el texto de la advertencia (Control por placa lo muestra junto al
-- botón de resolución). CREATE OR REPLACE en una migración nueva, nunca se
-- edita 20260918090016 ya aplicada/pusheada.

create or replace function public.sugerir_accion_novedad(p_mensaje text)
returns text
language sql
immutable
as $$
  select case
    when p_mensaje ilike '%no está registrada en Vehículos%' then 'Registrar el vehículo en el módulo Vehículos.'
    when p_mensaje ilike '%no tiene correo%' then 'Agregar un correo de contacto en la ficha del vehículo.'
    when p_mensaje ilike '%fuera del rango del período%' then 'Revisar la fecha: moverla al período real, dejarla como rezago, excluirla o corregirla.'
    when p_mensaje ilike '%recuperada desde el campo Chofer%' then 'Verificar la placa y corregirla si el dato de Fénix estaba mal.'
    when p_mensaje ilike '%por revisar%' then 'Reclasificar el centro de costo del tipo de ruta (ver Corrección masiva).'
    when p_mensaje ilike '%Valor en 0%' then 'Verificar el valor de la ODT en Fénix.'
    when p_mensaje ilike '%Tipo de Costo vacío%' then 'Completar el tipo de costo de la ODT.'
    else null
  end;
$$;

comment on function public.sugerir_accion_novedad(text) is
  'Acción sugerida a partir del texto de una advertencia de importación, usada por Control por placa.';

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
      insert into public.novedad (tipo, severidad, entidad, entidad_id, placa, guia, periodo_id, mensaje, accion_sugerida)
      select
        'IMPORTACION',
        'ADVERTENCIA',
        'odt',
        v_odt_id,
        r.datos_normalizados ->> 'placaNormalizada',
        r.datos_normalizados ->> 'guia',
        v_periodo_id,
        adv.value #>> '{}',
        public.sugerir_accion_novedad(adv.value #>> '{}')
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
