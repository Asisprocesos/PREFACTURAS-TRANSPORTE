-- Tipos enumerados usados en todo el esquema.

create type public.rol_usuario as enum ('ADMIN', 'OPERADOR_TRANSPORTE', 'CONSULTA');

create type public.estado_periodo as enum ('ABIERTO', 'CERRADO', 'ARCHIVADO');

create type public.estado_importacion as enum ('BORRADOR', 'VALIDADA', 'CONFIRMADA', 'REVERTIDA');

create type public.decision_fila as enum ('INSERTAR', 'OMITIR', 'CORREGIR');

create type public.estado_prefactura as enum (
  'BORRADOR',
  'CON_NOVEDADES',
  'LISTA',
  'PDF_GENERADO',
  'EN_COLA_ENVIO',
  'ENVIADA',
  'ERROR_ENVIO',
  'REQUIERE_REGENERAR',
  'ANULADA'
);

create type public.estado_documento_pdf as enum ('VIGENTE', 'REEMPLAZADO');

create type public.estado_envio as enum ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR', 'REINTENTAR');

create type public.tipo_lote_proceso as enum ('PDF', 'CORREO', 'VALIDACION');

create type public.estado_lote_proceso as enum ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'COMPLETADO_CON_ERRORES');

create type public.severidad_novedad as enum ('ERROR', 'ADVERTENCIA', 'INFO');

create type public.estado_novedad as enum ('ABIERTA', 'RESUELTA', 'IGNORADA');

create type public.etapa_log_ejecucion as enum ('IMPORTACION', 'VALIDACION', 'PDF', 'CORREO');

create type public.estado_log_ejecucion as enum ('OK', 'ADVERTENCIA', 'ERROR');

create type public.tipo_contacto_correo as enum ('PRINCIPAL', 'ADICIONAL');

create type public.macro_negocio as enum ('CORE', 'TEMU');
