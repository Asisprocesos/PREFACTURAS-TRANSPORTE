-- Soporte para reanudar o cancelar ejecuciones largas (importar, generar PDF masivo, carga masiva de maestros, envío de correo) que hoy se pierden por completo si el usuario cambia de pantalla a medias.
alter type public.estado_lote_proceso add value if not exists 'CANCELADO';
alter type public.estado_envio add value if not exists 'CANCELADO';
alter type public.tipo_lote_proceso add value if not exists 'MAESTROS';
alter table public.lote_proceso add column if not exists periodo_id uuid references public.periodo (id);
alter table public.lote_proceso add column if not exists detalle text;
comment on column public.lote_proceso.periodo_id is 'Período al que pertenece el lote (PDF/MAESTROS no siempre tienen uno propio vía envio_correo), para poder detectar un lote PROCESANDO sin terminar al volver a esa pantalla.';
comment on column public.lote_proceso.detalle is 'Etiqueta legible para la pantalla de Ejecuciones (ej. "PDF masivo · período 3-13-Sep-12-Oct"), sin tener que reconstruirla con joins.';
alter table public.importacion add column if not exists borrador jsonb;
comment on column public.importacion.borrador is 'Hoja elegida, fila de encabezado, mapeo de columnas y período elegidos en los pasos 2-3 del asistente, guardados apenas se eligen (antes de "Validar") para poder reanudar el mapeo desde /importar/{id} si se abandona el asistente a medias.';
