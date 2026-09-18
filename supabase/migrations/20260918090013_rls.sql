-- RLS: activado en todas las tablas de negocio. Modelo de acceso:
--   ADMIN               -> todo (lectura y escritura en cualquier tabla)
--   OPERADOR_TRANSPORTE -> lee todo; escribe en tablas operativas
--                          (importación, ODT, prefacturas, PDFs, correo,
--                          novedades, escaneo, correcciones); NO administra
--                          catálogos, usuarios ni configuración
--   CONSULTA             -> solo lectura en todo
-- `public.rol_actual()` es SECURITY DEFINER y devuelve null si el usuario
-- no tiene perfil activo, por lo que un usuario sin perfil no cumple
-- ninguna política (deny-by-default de RLS).
--
-- Los nombres de política se arman ANTES de pasarlos a format(), no
-- pegando texto literal justo después de un placeholder %I: format()
-- entrecomilla el identificador cuando hace falta (mayúsculas, reservados),
-- y "%I_sufijo" rompería la sentencia en ese caso (quedaría
-- `"tabla"_sufijo`, inválido). Concatenar antes evita ese riesgo aunque hoy
-- ningún nombre de tabla lo dispare.

-- Tablas donde CONSULTA también puede leer, pero solo ADMIN escribe.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'regional', 'periodo', 'ruta_macro', 'tipo_ruta_centro_costo', 'calendario',
    'mapeo_columna', 'configuracion'
  ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (public.rol_actual() is not null)',
      t || '_lectura', t);
    execute format(
      'create policy %I on public.%I for all using (public.rol_actual() = ''ADMIN'') with check (public.rol_actual() = ''ADMIN'')',
      t || '_admin_escribe', t);
  end loop;
end $$;

-- Maestros: ADMIN y OPERADOR_TRANSPORTE pueden mantenerlos (se editan desde
-- el día a día de Transporte, no son catálogos de sistema); CONSULTA solo lee.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'transportista', 'vehiculo', 'conductor', 'vehiculo_conductor', 'contacto_correo'
  ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (public.rol_actual() is not null)',
      t || '_lectura', t);
    execute format(
      'create policy %I on public.%I for all using (public.rol_actual() in (''ADMIN'', ''OPERADOR_TRANSPORTE'')) with check (public.rol_actual() in (''ADMIN'', ''OPERADOR_TRANSPORTE''))',
      t || '_operador_escribe', t);
  end loop;
end $$;

-- Operación: ADMIN y OPERADOR_TRANSPORTE trabajan el flujo completo;
-- CONSULTA solo lee.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'importacion', 'importacion_fila', 'odt', 'odt_correccion',
    'prefactura', 'prefactura_detalle', 'descuento', 'factura_transportista',
    'documento_pdf', 'lote_proceso', 'envio_correo',
    'novedad', 'sesion_escaneo', 'escaneo_odt',
    'log_ejecucion', 'odt_indice_historico', 'archivo_periodo'
  ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (public.rol_actual() is not null)',
      t || '_lectura', t);
    execute format(
      'create policy %I on public.%I for all using (public.rol_actual() in (''ADMIN'', ''OPERADOR_TRANSPORTE'')) with check (public.rol_actual() in (''ADMIN'', ''OPERADOR_TRANSPORTE''))',
      t || '_operador_escribe', t);
  end loop;
end $$;

-- correlativo: nadie lo lee/edita directo desde el cliente, solo la función
-- SECURITY DEFINER `siguiente_correlativo`. Se activa RLS sin policies
-- (deny-all vía API; la función sigue funcionando porque corre con los
-- privilegios del dueño, no los del usuario que dispara el trigger).
alter table public.correlativo enable row level security;

-- auditoria: de solo lectura para ADMIN (nadie más debe ver quién hizo qué a
-- ese nivel de detalle); las inserciones las hacen los triggers
-- SECURITY DEFINER, nunca el cliente.
alter table public.auditoria enable row level security;
create policy auditoria_admin_lee on public.auditoria for select
  using (public.rol_actual() = 'ADMIN');

-- perfil_usuario: cada quien ve su propio perfil; ADMIN ve y administra todos.
alter table public.perfil_usuario enable row level security;
create policy perfil_usuario_propio on public.perfil_usuario for select
  using (user_id = auth.uid() or public.rol_actual() = 'ADMIN');
create policy perfil_usuario_admin_escribe on public.perfil_usuario for all
  using (public.rol_actual() = 'ADMIN')
  with check (public.rol_actual() = 'ADMIN');
