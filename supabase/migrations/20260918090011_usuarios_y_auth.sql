-- Restricción de dominio de correo + creación automática de perfil_usuario
-- al registrarse, y la función que resuelve el rol del usuario actual
-- (usada por todas las políticas RLS).

-- El dominio permitido vive en config/app.config.ts (`dominioCorreoPermitido`)
-- y se overridea, igual que el resto de la config, desde `configuracion`.
-- Aquí se hardcodea como defensa en profundidad a nivel de base de datos
-- (la UI ya lo valida con Zod antes de llamar a Supabase Auth); si el
-- dominio cambia, actualizar esta función con una migración nueva.
create or replace function public.validar_dominio_correo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and new.email !~* '@grupolaar\.com$' then
    raise exception 'El acceso está restringido a correos @grupolaar.com';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_validar_dominio
  before insert on auth.users
  for each row execute function public.validar_dominio_correo();

-- Crea el perfil (rol CONSULTA por defecto; un ADMIN debe promoverlo) en
-- cuanto se crea el usuario en auth.users.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfil_usuario (user_id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email), 'CONSULTA')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- Rol del usuario autenticado actual. SECURITY DEFINER + search_path fijo
-- para poder leer perfil_usuario desde dentro de las políticas RLS de
-- cualquier otra tabla sin depender de que esas políticas ya autoricen la
-- lectura de perfil_usuario (evita recursión).
create or replace function public.rol_actual()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfil_usuario where user_id = auth.uid() and activo = true;
$$;

comment on function public.rol_actual() is
  'Rol del usuario autenticado actual (ADMIN/OPERADOR_TRANSPORTE/CONSULTA), o null si no tiene perfil activo. Usada por todas las políticas RLS.';
