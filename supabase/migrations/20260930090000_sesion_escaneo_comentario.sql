-- Comentario opcional de la sesión de escaneo (ver panel-escaneo.tsx): para
-- dejar registrado algo que no cabe en las columnas del match (ej. "faltan
-- 3 guías por recibir del transportista", "ODT dañada, guía ilegible").

alter table public.sesion_escaneo add column comentario text;

comment on column public.sesion_escaneo.comentario is
  'Nota libre y opcional del operador sobre la sesión de escaneo.';
