-- Envío masivo: prefacturas sin correo registrado (ni en el vehículo ni en
-- el transportista) se consolidan en UN solo correo con un ZIP adjunto en
-- vez de omitirse en silencio o mandar muchos correos sueltos a la misma
-- cuenta de respaldo (EMAIL_FALLBACK_RECIPIENT, configurable en Vercel).
--
-- Esa fila de envio_correo no corresponde a una sola prefactura, así que
-- prefactura_id pasa a ser opcional y se agregan las columnas necesarias
-- para el caso consolidado. El check garantiza que toda fila sea uno de los
-- dos casos válidos: individual (prefactura_id) o consolidado (zip +
-- prefactura_ids), nunca ninguno de los dos ni una mezcla incompleta.

alter table public.envio_correo alter column prefactura_id drop not null;

alter table public.envio_correo
  add column zip_storage_key text,
  add column zip_nombre_archivo text,
  add column prefactura_ids uuid[];

alter table public.envio_correo add constraint envio_correo_prefactura_o_zip check (
  (prefactura_id is not null and zip_storage_key is null)
  or (prefactura_id is null and zip_storage_key is not null and prefactura_ids is not null)
);

comment on column public.envio_correo.prefactura_id is
  'NULL cuando esta fila es un envío consolidado (zip_storage_key/prefactura_ids poblados en su lugar).';
comment on column public.envio_correo.zip_storage_key is
  'Ruta en el bucket "prefacturas" del ZIP con los PDF de las prefacturas sin correo registrado, generado una sola vez al encolar.';
comment on column public.envio_correo.prefactura_ids is
  'Prefacturas incluidas en el ZIP consolidado, para poder marcarlas ENVIADA/ERROR_ENVIO todas juntas al procesar esta fila.';

-- Limpieza de datos: correos ya importados con separadores pegados al final
-- (ej. "correo@dominio.com;") por una validación de la carga masiva de
-- Vehículos/Transportistas que no los rechazaba (ver limpiarEmail() en
-- src/lib/contactos/validar-email.ts). El proveedor SMTP rechaza esas
-- direcciones como destinatario inválido, causando envíos que fallan a
-- pesar de que el correo "existe".
update public.contacto_correo
set email = regexp_replace(trim(email), '^[;,\s]+|[;,\s]+$', '', 'g')
where email ~ '^[;,\s]+|[;,\s]+$';
