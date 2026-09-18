-- Control y trazabilidad: novedades, escaneo de ODT físicas, log de
-- ejecuciones por ODT, auditoría genérica, configuración en runtime y
-- perfiles/roles de usuario.

create table public.novedad (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  severidad public.severidad_novedad not null,
  entidad text not null, -- 'odt' | 'vehiculo' | 'prefactura' | 'importacion' | ...
  entidad_id uuid,
  placa text,
  guia text,
  periodo_id uuid references public.periodo (id),
  mensaje text not null,
  accion_sugerida text,
  estado public.estado_novedad not null default 'ABIERTA',
  resuelta_por uuid references auth.users (id),
  resolucion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index novedad_periodo_idx on public.novedad (periodo_id);
create index novedad_estado_idx on public.novedad (estado);
create index novedad_entidad_idx on public.novedad (entidad, entidad_id);
create index novedad_placa_idx on public.novedad (placa);
create trigger set_updated_at before update on public.novedad
  for each row execute function public.set_updated_at();

comment on table public.novedad is
  'Novedades del período (placa sin correo, valor 0, fecha fuera de corte, duplicados, etc), con acción sugerida y resolución.';

create table public.sesion_escaneo (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references public.periodo (id),
  placa text,
  iniciada_por uuid references auth.users (id),
  iniciada_en timestamptz not null default now(),
  finalizada_en timestamptz
);
create index sesion_escaneo_periodo_idx on public.sesion_escaneo (periodo_id);

comment on table public.sesion_escaneo is 'Sesión de escaneo de ODT físicas por período (y opcionalmente por placa).';

create table public.escaneo_odt (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.sesion_escaneo (id) on delete cascade,
  guia_escaneada text not null,
  escaneado_por uuid references auth.users (id),
  escaneado_en timestamptz not null default now()
);
create index escaneo_odt_sesion_idx on public.escaneo_odt (sesion_id);
create index escaneo_odt_guia_idx on public.escaneo_odt (guia_escaneada);
-- Rechaza lecturas repetidas dentro de la misma sesión.
create unique index escaneo_odt_sesion_guia_unica on public.escaneo_odt (sesion_id, guia_escaneada);

comment on table public.escaneo_odt is
  'Lecturas crudas de ODT físicas (lector USB o cámara). El match contra `odt` se calcula en la vista v_match_escaneo.';

create table public.log_ejecucion (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null,
  guia text,
  etapa public.etapa_log_ejecucion not null,
  estado public.estado_log_ejecucion not null,
  detalle jsonb,
  fecha timestamptz not null default now()
);
create index log_ejecucion_ejecucion_idx on public.log_ejecucion (ejecucion_id);
create index log_ejecucion_guia_idx on public.log_ejecucion (guia);
create index log_ejecucion_etapa_estado_idx on public.log_ejecucion (etapa, estado);

comment on table public.log_ejecucion is
  'Log de repositorio por ODT: una fila por etapa (importación/validación/PDF/correo) y resultado.';

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario uuid references auth.users (id),
  accion text not null, -- INSERT | UPDATE | DELETE | DESCARGA | ENVIO | ...
  tabla text not null,
  registro_id uuid,
  antes jsonb,
  despues jsonb,
  ip text,
  fecha timestamptz not null default now()
);
create index auditoria_tabla_registro_idx on public.auditoria (tabla, registro_id);
create index auditoria_usuario_idx on public.auditoria (usuario);
create index auditoria_fecha_idx on public.auditoria (fecha);

comment on table public.auditoria is
  'Auditoría genérica (triggers en tablas sensibles + registros manuales de descarga/envío). Nunca contiene contraseñas ni tokens.';

create table public.configuracion (
  clave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create trigger set_updated_at before update on public.configuracion
  for each row execute function public.set_updated_at();

comment on table public.configuracion is
  'Overrides en runtime de config/app.config.ts (clave = ruta del campo, ej. "correo", "numeracion").';

create table public.perfil_usuario (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  rol public.rol_usuario not null default 'CONSULTA',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index perfil_usuario_rol_idx on public.perfil_usuario (rol);
create trigger set_updated_at before update on public.perfil_usuario
  for each row execute function public.set_updated_at();

comment on table public.perfil_usuario is
  'Rol de cada usuario (ADMIN, OPERADOR_TRANSPORTE, CONSULTA). Se crea automáticamente al registrarse (ver trigger on_auth_user_created).';
