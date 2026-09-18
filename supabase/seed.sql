-- Seed de catálogos para desarrollo local (`supabase db reset` lo ejecuta
-- automáticamente después de las migraciones).
--
-- IMPORTANTE: varios de estos catálogos (ruta_macro, tipo_ruta_centro_costo,
-- regional) NO se conocen con certeza porque los archivos fuente reales
-- (docs/fuentes/MACRO_CORTE_13_JUL_-_12_AGO.xlsb, hoja DATA LIST) no están
-- disponibles en este entorno — ver docs/diagnostico-excel.md. Lo marcado
-- como "EJEMPLO" debe reemplazarse por `scripts/migrar-maestros.ts` (fase 7)
-- en cuanto el archivo real esté disponible. Lo marcado como "verificado"
-- viene directo del diagnóstico preliminar confirmado por el equipo de
-- Transporte y es seguro de mantener.

-- ── Regionales (verificado: sedes de LAARCOURIER en config/app.config.ts) ──
insert into public.regional (nombre, codigo) values
  ('Quito', 'UIO'),
  ('Guayaquil', 'GYE')
on conflict do nothing;

-- ── Períodos de ejemplo (13→12), alrededor de la fecha del corte de
--    referencia del diagnóstico (12 de septiembre de 2026). La numeración
--    exacta (`numero`) debe alinearse con la del DATA LIST real al migrar. ──
insert into public.periodo (numero, nombre, fecha_inicio, fecha_fin, estado) values
  (1, '1-13-Jul-12-Aug', '2026-07-13', '2026-08-12', 'CERRADO'),
  (2, '2-13-Aug-12-Sep', '2026-08-13', '2026-09-12', 'ABIERTO'),
  (3, '3-13-Sep-12-Oct', '2026-09-13', '2026-10-12', 'ABIERTO')
on conflict do nothing;

-- ── Tipo de Ruta -> Centro de Costo (EJEMPLO salvo REEMPLAZO TRANSPORTE,
--    que sí está verificado en el diagnóstico: requiere reclasificación). ──
insert into public.tipo_ruta_centro_costo (tipo_ruta, macro, centro_costo, requiere_revision) values
  ('REEMPLAZO TRANSPORTE', null, null, true), -- verificado: 4 ODT del corte de referencia
  ('VIAJE REGIONAL', 'CORE', 'VIAJE REGIONAL', false),          -- EJEMPLO
  ('DISTRIBUCION', 'CORE', 'DISTRIBUCION', false),               -- EJEMPLO
  ('RECOLECCION', 'CORE', 'RECOLECCION', false),                 -- EJEMPLO
  ('JORNADA COMPLETA', 'CORE', 'JORNADA COMPLETA', false),       -- EJEMPLO
  ('ENTREGA TEMU', 'TEMU', 'ENTREGA TEMU', false),                -- EJEMPLO
  ('ADUANA TEMU', 'TEMU', 'ADUANA TEMU', false),                  -- EJEMPLO
  ('PROCESAMIENTO TEMU', 'TEMU', 'PROCESAMIENTO TEMU', false),    -- EJEMPLO
  ('VIAJE REGIONAL TEMU', 'TEMU', 'VIAJE REGIONAL TEMU', false)   -- EJEMPLO
on conflict do nothing;

-- ── Calendario laborable: 2025-01-01 a 2027-12-31, lunes a viernes
--    laborable=true. No modela feriados de Ecuador (no hay fuente de datos
--    confiable en este entorno); un ADMIN puede corregir fechas puntuales
--    directo en la tabla mientras se agrega un catálogo de feriados. ──
insert into public.calendario (fecha, dia_texto, laborable)
select
  d::date,
  (array['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'])[extract(dow from d)::int + 1],
  extract(dow from d) not in (0, 6)
from generate_series('2025-01-01'::date, '2027-12-31'::date, interval '1 day') as d
on conflict (fecha) do nothing;

-- ── Mapeo de columnas (verificado contra el diagnóstico del corte Fénix) ──
insert into public.mapeo_columna (plantilla, alias_origen, campo_interno) values
  ('default', 'Guía', 'odt.guia'),
  ('default', 'Guia', 'odt.guia'),
  ('default', 'Chofer', 'odt.chofer'),
  ('default', 'Ruta', 'odt.ruta'),
  ('default', 'Regional Origen', 'odt.regional_origen_texto'),
  ('default', 'Estado', 'odt.estado_fenix'),
  ('default', 'Fecha Recepción', 'odt.fecha_recepcion'),
  ('default', 'Valor', 'odt.valor'),
  ('default', 'Tipo de Costo', 'odt.tipo_costo'),
  ('default', 'Tipo de Ruta', 'odt.tipo_ruta'),
  ('default', 'Ruta/Zona', 'odt.ruta_zona'),
  ('default', 'Ruta-Zona', 'odt.ruta_zona'), -- caso de prueba: mismo campo, nombre distinto en el .xlsb
  ('default', 'Placa', 'odt.placa_original'),
  ('default', 'Regional Destino', 'odt.regional_destino_texto'),
  ('default', 'Fecha Creación', 'odt.fecha_creacion'),
  ('default', 'Usuario', 'odt.usuario_fenix'),
  ('default', 'Detalle de la Ruta', 'odt.detalle_ruta')
on conflict do nothing;

-- La tabla `configuracion` se deja vacía a propósito: solo contiene
-- OVERRIDES sobre los valores por defecto de config/app.config.ts (ver
-- src/lib/config/resolver.ts). Sembrarla aquí duplicaría esa fuente de
-- verdad y la desalinearía con el tiempo.

-- No se siembran `auth.users` ni `perfil_usuario`: el primer ADMIN se crea
-- registrándose normalmente (@grupolaar.com) y luego, desde Supabase
-- Studio o `psql`, promoviéndolo:
--   update public.perfil_usuario set rol = 'ADMIN' where user_id =
--     (select id from auth.users where email = 'nombre@grupolaar.com');
