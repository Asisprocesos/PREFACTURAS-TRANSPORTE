-- Extiende la auditoría genérica (registrar_auditoria, ya usada en odt/prefactura/documento_pdf/envio_correo/vehiculo/transportista/perfil_usuario/configuracion) a las tablas de catálogo/maestros que todavía no dejan rastro de quién creó, modificó o eliminó un registro.
drop trigger if exists auditoria_conductor on public.conductor;
create trigger auditoria_conductor after insert or update or delete on public.conductor for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_vehiculo_conductor on public.vehiculo_conductor;
create trigger auditoria_vehiculo_conductor after insert or update or delete on public.vehiculo_conductor for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_contacto_correo on public.contacto_correo;
create trigger auditoria_contacto_correo after insert or update or delete on public.contacto_correo for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_periodo on public.periodo;
create trigger auditoria_periodo after insert or update or delete on public.periodo for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_regional on public.regional;
create trigger auditoria_regional after insert or update or delete on public.regional for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_tipo_ruta_centro_costo on public.tipo_ruta_centro_costo;
create trigger auditoria_tipo_ruta_centro_costo after insert or update or delete on public.tipo_ruta_centro_costo for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_descuento on public.descuento;
create trigger auditoria_descuento after insert or update or delete on public.descuento for each row execute function public.registrar_auditoria();
