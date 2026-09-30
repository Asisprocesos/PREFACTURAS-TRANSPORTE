-- La invitación de usuarios ahora tiene una casilla "Autorizar correo de
-- otro dominio" (ver invitarUsuario en src/lib/usuarios/actions.ts), pero el
-- trigger de la base de datos (validar_dominio_correo, migración
-- 20260918090011) seguía rechazando cualquier correo fuera de
-- @grupolaar.com sin excepción — de ahí el error "Database error saving new
-- user" al invitar con la casilla marcada. La UI ya no es la única
-- barrera (defensa en profundidad), así que el trigger debe conocer la
-- excepción: invitarUsuario pasa permitir_otro_dominio=true en los metadatos
-- del usuario cuando el ADMIN marca la casilla, y el trigger lo respeta.
-- Una sentencia por línea, idempotente (ver migraciones previas de esta
-- sesión): el editor SQL usado no siempre ejecuta el pegado como un bloque.
create or replace function public.validar_dominio_correo() returns trigger language plpgsql security definer set search_path = public as $$ begin if new.email is not null and new.email !~* '@grupolaar\.com$' and coalesce(new.raw_user_meta_data ->> 'permitir_otro_dominio', 'false') <> 'true' then raise exception 'El acceso está restringido a correos @grupolaar.com'; end if; return new; end; $$;
comment on function public.validar_dominio_correo() is 'Trigger before insert en auth.users: exige @grupolaar.com salvo que el usuario se haya creado con permitir_otro_dominio=true en sus metadatos (casilla de excepción en Invitar usuario).';
