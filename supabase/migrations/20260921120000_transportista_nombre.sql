-- Nombre comercial del transportista, distinto de la razón social (que se
-- mantiene para el RUC y los documentos formales como el PDF de
-- prefactura). Nullable porque los transportistas ya existentes no lo
-- tienen todavía; el formulario lo exige a partir de ahora.
alter table public.transportista add column nombre text;
