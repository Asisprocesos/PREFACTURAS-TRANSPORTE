-- Descuentos (multas al transportista) por ODT específica: antes `descuento`
-- solo existía atado a una prefactura fija (nunca tuvo UI). Ahora se ata a
-- la ODT (odt_id) — así el mismo descuento se refleja automáticamente en
-- cualquier prefactura que incluya esa guía (la principal y, si aplica,
-- alguna secundaria de ajuste), sin duplicar el dato. prefactura_id queda
-- nullable (legado, ya no se usa para escribir). "Corregir" = editar el
-- descuento existente o anularlo (soft delete); nunca se pierde el
-- historial. Una sentencia por línea a propósito (ver migraciones previas):
-- el editor SQL usado no siempre ejecuta el pegado como un solo bloque.
alter table public.descuento add column if not exists odt_id uuid references public.odt (id);
alter table public.descuento add column if not exists deleted_at timestamptz;
alter table public.descuento add column if not exists updated_at timestamptz not null default now();
alter table public.descuento alter column prefactura_id drop not null;
create index if not exists descuento_odt_idx on public.descuento (odt_id) where deleted_at is null;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'descuento_valor_positivo') then alter table public.descuento add constraint descuento_valor_positivo check (valor > 0); end if; end $$;
drop trigger if exists set_updated_at on public.descuento;
create trigger set_updated_at before update on public.descuento for each row execute function public.set_updated_at();
comment on table public.descuento is 'Descuentos/multas aplicados a una ODT específica (ej. paquetería dañada). Se reflejan en cualquier prefactura que incluya esa guía.';
comment on column public.descuento.odt_id is 'ODT (guía) a la que se aplica el descuento.';
comment on column public.descuento.concepto is 'Motivo del descuento (obligatorio).';
comment on column public.descuento.valor is 'Monto a descontar, siempre positivo.';
comment on column public.descuento.deleted_at is 'Si no es null, el descuento fue anulado (corrección) y no cuenta en los totales.';
-- generar_prefacturas_periodo ahora también recalcula total_descuentos desde
-- los descuentos activos de cada ODT del período (antes quedaba fijo en 0).
create or replace function public.generar_prefacturas_periodo(p_periodo_id uuid) returns table (prefacturas_creadas integer, prefacturas_actualizadas integer) language plpgsql security invoker set search_path = public as $$ declare v_creadas integer := 0; v_actualizadas integer := 0; begin update odt o set vehiculo_id = v.id from vehiculo v where o.periodo_id = p_periodo_id and o.vehiculo_id is null and o.placa_normalizada = v.placa and v.deleted_at is null; with descuentos_odt as (select odt_id, sum(valor) as valor from descuento where deleted_at is null group by odt_id), agregado as (select o.vehiculo_id, v.transportista_id, count(*) as cantidad_odt, sum(coalesce(o.valor_final, o.valor)) as total_odt, coalesce(sum(d.valor), 0) as total_descuentos from odt o join vehiculo v on v.id = o.vehiculo_id left join descuentos_odt d on d.odt_id = o.id where o.periodo_id = p_periodo_id and o.vehiculo_id is not null and v.transportista_id is not null group by o.vehiculo_id, v.transportista_id), upsert as (insert into prefactura (periodo_id, vehiculo_id, transportista_id, total_odt, total_descuentos, total, cantidad_odt, estado) select p_periodo_id, a.vehiculo_id, a.transportista_id, a.total_odt, a.total_descuentos, a.total_odt - a.total_descuentos, a.cantidad_odt, 'BORRADOR' from agregado a on conflict (vehiculo_id, periodo_id) where es_principal do update set total_odt = excluded.total_odt, total_descuentos = excluded.total_descuentos, total = excluded.total_odt - excluded.total_descuentos, cantidad_odt = excluded.cantidad_odt, transportista_id = excluded.transportista_id, estado = case when prefactura.estado in ('BORRADOR', 'CON_NOVEDADES') then 'BORRADOR' else prefactura.estado end returning (xmax = 0) as es_nuevo) select count(*) filter (where es_nuevo)::integer, count(*) filter (where not es_nuevo)::integer into v_creadas, v_actualizadas from upsert; insert into prefactura_detalle (prefactura_id, odt_id) select p.id, o.id from odt o join prefactura p on p.vehiculo_id = o.vehiculo_id and p.periodo_id = p_periodo_id and p.es_principal where o.periodo_id = p_periodo_id and o.vehiculo_id is not null on conflict (prefactura_id, odt_id) do nothing; return query select v_creadas, v_actualizadas; end; $$;
comment on function public.generar_prefacturas_periodo(uuid) is 'Botón "Generar prefacturas del período": vincula ODT huérfanas, hace UPSERT de 1 prefactura PRINCIPAL por vehículo (con total_descuentos recalculado desde descuento), congela prefactura_detalle. El correlativo solo se asigna a las nuevas.';
