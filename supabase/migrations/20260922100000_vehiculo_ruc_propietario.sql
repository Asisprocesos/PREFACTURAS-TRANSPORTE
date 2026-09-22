-- RUC del propietario del vehículo (puede diferir del RUC del
-- transportista/contratista asignado, p. ej. cuando el vehículo es de un
-- tercero que opera bajo el contratista). Se guarda junto al nombre del
-- propietario para que, comparándolo con el RUC del transportista, se
-- pueda verificar si se trata de la misma persona.
alter table public.vehiculo add column ruc_propietario text;
