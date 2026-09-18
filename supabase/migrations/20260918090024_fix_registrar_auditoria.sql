-- Corrige registrar_auditoria(): asumía que toda tabla auditada tiene una
-- columna `id`, pero `perfil_usuario` usa `user_id` como llave primaria y
-- `configuracion` usa `clave` (texto). Referenciar `old.id`/`new.id` como
-- campo de un registro tipado por la tabla en cuestión falla con
-- "record has no field id" (SQLSTATE 42703) en cuanto la fila no tiene esa
-- columna — se reprodujo al invitar el primer usuario (dispara
-- crear_perfil_usuario -> INSERT en perfil_usuario -> auditoria_perfil_usuario).
--
-- Fix: extraer el id vía jsonb (dinámico, no requiere que la columna exista
-- en el tipo de fila) probando 'id', luego 'user_id', luego 'clave'; y
-- `registro_id` pasa de `uuid` a `text` porque `configuracion.clave` no es
-- un UUID.

alter table public.auditoria alter column registro_id type text using registro_id::text;

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_registro_id text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_registro_id := coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'clave');

  insert into public.auditoria (usuario, accion, tabla, registro_id, antes, despues)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    v_registro_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

comment on function public.registrar_auditoria() is
  'Trigger AFTER INSERT/UPDATE/DELETE: registra el cambio en auditoria. Extrae el id de la fila vía jsonb (id/user_id/clave) en vez de old.id/new.id, porque no todas las tablas auditadas usan "id" como llave primaria.';
