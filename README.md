# Prefacturación de Transporte — LAARCOURIER

Sistema de prefacturación de transporte para **LAARCOURIER (Grupo LAAR,
Ecuador)**, que reemplaza el proceso manual basado en el archivo Excel con
macros `MACRO CORTE 13 – 12` (instructivo IO-20304C).

> **Estado actual del proyecto.** Este repositorio está en construcción por
> fases. Ver la sección [Estado actual](#estado-actual) para lo que ya está
> implementado y lo que falta.

## Índice

- [Arquitectura](#arquitectura)
- [Estado actual](#estado-actual)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Configuración de la aplicación](#configuración-de-la-aplicación)
- [Base de datos y migraciones](#base-de-datos-y-migraciones)
- [Seeds y migración de maestros](#seeds-y-migración-de-maestros)
- [Ejecución local](#ejecución-local)
- [Pruebas](#pruebas)
- [Generación de PDF](#generación-de-pdf)
- [Correo (Zimbra y plan B transaccional)](#correo-zimbra-y-plan-b-transaccional)
- [Modo prueba de correo](#modo-prueba-de-correo)
- [pg_cron](#pg_cron)
- [Despliegue](#despliegue)
- [Política de archivo de períodos](#política-de-archivo-de-períodos)
- [Solución de problemas](#solución-de-problemas)

## Arquitectura

Monorepo simple: una sola app Next.js 15 (App Router) para UI + API, sobre
Supabase (PostgreSQL + Auth + Storage), desplegada en Vercel. El detalle
completo — componentes, modelo entidad-relación, flujos de importación, PDF,
almacenamiento y correo, y las decisiones técnicas — está en
[`docs/arquitectura.md`](docs/arquitectura.md).

El diagnóstico de la estructura real de los archivos Excel/xlsb del proceso
actual está en [`docs/diagnostico-excel.md`](docs/diagnostico-excel.md).

## Estado actual

| Fase                       | Contenido                                                                                                                                   | Estado                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1. Diagnóstico             | `docs/diagnostico-excel.md`, `scripts/analizar-excel.ts`                                                                                    | ✅ Hecho (basado en diagnóstico preliminar; falta re-ejecutar con los archivos reales, ver `docs/fuentes/README.md`) |
| 2. Arquitectura            | `docs/arquitectura.md`                                                                                                                      | ✅ Hecho                                                                                                             |
| 3. Estructura del proyecto | Next.js 15, Tailwind, shadcn/ui-style, Vitest, Playwright, ESLint, Prettier, CI                                                             | ✅ Hecho                                                                                                             |
| 4. Base de datos           | `supabase/migrations/`, RLS, índices, triggers, seeds                                                                                       | ✅ Hecho (migraciones y seeds versionados; **no aplicadas** contra ningún proyecto Supabase real todavía)            |
| 5. Autenticación y roles   | Supabase Auth, restricción `@grupolaar.com`, `perfil_usuario`, `rol_actual()`, UI de Usuarios (`/usuarios`)                                 | ✅ Hecho: invitar, listar, cambiar rol y activar/desactivar (solo ADMIN)                                             |
| 6. Transportistas          | `/transportistas` (CRUD, búsqueda, correos de contacto)                                                                                     | ✅ Hecho                                                                                                             |
| 7. Vehículos               | `/vehiculos` (CRUD, correos, historial), `scripts/migrar-maestros.ts`                                                                       | ✅ Hecho (migración de maestros lista, dry-run por defecto; pendiente correr contra el `.xlsb` real)                 |
| 8. Importador Excel        | `/importar` (asistente 5 pasos), Web Worker de previsualización, validación server-side, RPC `confirmar_importacion`/`revertir_importacion` | ✅ Hecho, ver limitaciones conocidas abajo                                                                           |
| 9. Prefacturas             | `/prefacturas` (listado, generación, detalle con resumen y ODT)                                                                             | ✅ Hecho (Enviar por correo queda como placeholder hasta la fase 12)                                                 |
| 9. Control por placa       | `/control-placa` (semáforo, resolución de novedades)                                                                                        | ✅ Hecho                                                                                                             |
| 9. Validación ODT          | `/validacion-odt` (buscador → reusa el detalle de prefactura)                                                                               | ✅ Hecho (falta el cruce ODT MANUAL, que depende de `factura_transportista`, fuera de alcance por ahora)             |
| 9. Escaneo de ODT          | `/validacion-odt/escaneo` (lector USB, pegar lista, match de 4 resultados, exportar Excel)                                                  | ✅ Hecho vía lector USB/teclado y lista pegada; **cámara (@zxing/browser) no implementada**, ver limitaciones abajo  |
| 9. Corrección manual       | `/odt/[guia]/corregir` (individual) y `/control-placa/correccion-masiva` (masiva)                                                           | ✅ Hecho                                                                                                             |
| 10. Generador de PDF       | `src/pdf/templates/prefactura/`, `POST/GET /api/prefacturas/:id/pdf`                                                                        | ✅ Hecho, generación real verificada fuera del proyecto (ver sección Generación de PDF)                              |
| 11. Repositorio documental | `/repositorio` (filtros, ver/descargar con auditoría, historial de versiones, reenviar)                                                     | ✅ Hecho                                                                                                             |
| 12. Sistema de correo      | `EmailProvider`/SMTP, envío individual y masivo, `/api/jobs/email`, pg_cron, progreso en tiempo real                                        | ✅ Hecho, ver sección Correo y sus limitaciones abajo                                                                |
| 13. Dashboard              | `/dashboard` (indicadores reales, avance de envío, gráficos por centro de costo/regional/top placas)                                       | ✅ Hecho, RPC `dashboard_*` con `security invoker` (respeta RLS por rol)                                             |
| 13. Buscador dinámico      | `/buscador` (ODT por guía, placa, transportista, período, estado, fecha; paginación por cursor)                                            | ✅ Hecho                                                                                                             |
| 13. Reportes               | `/reportes` (prefacturas, enviadas, pendientes, errores de envío, resumen por centro de costo, rezagos) exportables a Excel                | ✅ Hecho; "costo por pieza" fuera de alcance (el modelo no tiene datos de pieza), ver limitaciones abajo             |
| 14. Log de ejecuciones     | `/historial` (estado por ODT en importación/validación/PDF/correo)                                                                          | ✅ Hecho; importación ya lo poblaba, se agregó el registro por ODT en generación de PDF y envío de correo            |
| 14. Cierre de período      | `/configuracion` → "Cerrar período" (solo ADMIN, bloquea si hay novedades ERROR abiertas)                                                   | ✅ Hecho                                                                                                             |
| 14. Archivo de período     | `/configuracion` → "Archivar" (snapshot .xlsx en bucket `archivo` + `odt_indice_historico`) y "Restaurar"                                   | ✅ Hecho; no borra `odt`/`prefactura` (queda como mejora incremental), ver limitaciones abajo                        |
| 14. Duplicados/rezagos     | Resolución vía Control por placa (`resolverNovedadAction`, texto libre) y reporte de Rezagos                                               | ✅ Hecho tal como está en fase 9/13; sin un enum dedicado por alternativa, ver limitaciones abajo                    |
| 15–16. Módulos restantes   | Pruebas E2E (Playwright), despliegue                                                                                                        | ⏳ Pendiente                                                                                                         |

Cada fase, al completarse, se documenta con: qué se implementó, qué archivos
se crearon, qué decisiones técnicas se tomaron, cómo probarlo y qué falta —
ver el historial de commits (`git log`) y los mensajes de cada commit.

## Limitaciones conocidas

- **Correo (SMTP y pg_cron) sin probar contra servicios reales.** No hay
  credenciales de Zimbra ni un proyecto Supabase con `pg_cron`/`pg_net`
  disponibles en este entorno. Se validó: el módulo compila y tipa
  correctamente (`next build`), la lógica de reintentos/backoff y la
  clasificación error permanente/temporal están implementadas, y las
  migraciones de `pg_cron` pasan el parser estático de Postgres — pero
  falta una prueba real de extremo a extremo (enviar un correo de verdad,
  ver que `pg_cron` dispare el worker). Usa `EMAIL_TEST_MODE=true` (activo
  por defecto) y Mailpit/`smtp-server` en local antes de un envío real.
- **Progreso en tiempo real (Supabase Realtime) sin probar en navegador
  real**, por la misma razón que el resto de las piezas de navegador de
  este proyecto (ver el punto del Web Worker más abajo). La página
  `/prefacturas/lotes/:id` también renderiza el estado inicial desde el
  servidor, así que sigue siendo útil aunque el canal de Realtime no
  conecte.
- **Escaneo de ODT solo por lector USB (teclado) y lista pegada.** La
  captura por cámara del navegador (`@zxing/browser`, ya en
  `package.json`) no se implementó todavía: requiere probarse con una
  cámara real y no hay forma de verificarlo en este entorno sin
  navegador. El lector USB (que se comporta como teclado + Enter) y
  "pegar una lista" sí están implementados y cubren el caso de uso
  principal.
- **Cruce "ODT MANUAL" de Validación ODT no implementado.** Esa sección
  del Excel original depende de cargar la factura física del
  transportista (`factura_transportista`, tabla ya creada en las
  migraciones); la UI para registrar esos datos es una fase posterior
  no cubierta todavía.
- **Web Worker del importador no probado en un navegador real.** Este
  entorno de desarrollo no tiene navegador disponible para hacer clic a
  través del asistente de importación. Se verificó que `next build`
  compila `src/workers/excel-parser.worker.ts` como un chunk separado y
  que `new Worker(new URL(...))` queda correctamente reescrito hacia ese
  chunk (inspeccionado en `.next/static/chunks/`), pero falta una prueba
  manual end-to-end con un archivo real antes de usarlo en producción.
- **Validación de importación en una sola pasada, no por lotes reanudables.**
  `validarImportacionAction` (fase 8) descarga y valida el archivo completo
  en una sola ejecución del servidor. Funciona bien para archivos de hasta
  unos pocos miles de filas; para el corte completo (~15.000 filas) en
  Vercel, conviene partirlo en lotes idempotentes como se describe en
  `docs/arquitectura.md`, sección de decisiones técnicas (punto 6). Se deja
  como mejora incremental, no bloquea el uso del importador.
- **`scripts/migrar-maestros.ts` y `scripts/analizar-excel.ts` no se han
  ejecutado contra archivos reales** (no están disponibles en este
  entorno). Ver `docs/fuentes/README.md`.
- Los flujos que dependen de un proyecto Supabase real (login, RLS,
  Storage, RPC `confirmar_importacion`) se verificaron con `next build` y
  revisión manual del SQL, pero no se han probado end-to-end contra una
  base de datos real.
- **Reporte de Rezagos: aproximación, no un campo dedicado.** El modelo no
  tiene un enum para "el operador eligió rezago" entre las 4 alternativas
  de resolución de una novedad de fecha fuera de corte (mover, rezago,
  excluir, corregir); `novedad.resolucion` es texto libre. El reporte
  `/reportes?tipo=rezagos` lista **todas** las novedades de ese tipo en el
  período (con su columna "Diferencias" mostrando la resolución tal cual
  la escribió el operador, o "Pendiente de resolución" si sigue abierta),
  en vez de filtrar solo las marcadas como rezago.
- **Reporte "costo por pieza" no implementado.** El modelo de datos no
  tiene una unidad de pieza/cantidad transportada, solo `valor`/`valor_final`
  por ODT; el criterio de aceptación original permite omitirlo si no hay
  datos de pieza disponibles.
- **Buscador dinámico busca solo ODT** (guía, placa, transportista,
  período, estado Fénix, fecha), no prefacturas ni otras entidades; para
  buscar por número de prefactura ya existe el filtro dedicado en
  `/prefacturas`.
- **Archivar período no borra `odt`/`prefactura`.** Genera el snapshot
  .xlsx, lo sube a `archivo` y construye `odt_indice_historico`, pero deja
  las tablas operativas intactas — una decisión deliberada para que
  archivar/restaurar sea reversible sin lógica de restore de datos. La
  poda física de las tablas operativas (para el caso de uso real de
  "aligerar la base tras archivar") queda como mejora incremental.
- **Sin pg_cron para el archivo automático de períodos.** A diferencia del
  worker de correo, "archivar períodos más allá de `periodosCalientes`" es
  un botón manual en `/configuracion` (`archivarPeriodosAntiguosAction`),
  no un job programado: archivar sube un snapshot y toca varias tablas, y
  se prefirió dejarlo a criterio explícito de un ADMIN antes que un job
  silencioso a medianoche sin poder probarse contra un Supabase real en
  este entorno.
- **"Rezago" en duplicados/fecha-fuera-de-corte es texto libre, no un
  enum.** El modelo no distingue estructuralmente cuál de las 4
  alternativas (mover, rezago, excluir, corregir / conservar, reemplazar,
  reasignar, marcar revisión) eligió el operador — vive en
  `novedad.resolucion` como texto. El reporte de Rezagos y el Log de
  ejecuciones muestran ese texto tal cual, en vez de filtrar por una
  alternativa específica.

## Instalación

Requiere Node.js ≥ 20.

```bash
npm install
cp .env.example .env.local   # completar con tus credenciales (ver abajo)
npm run dev                  # http://localhost:3000
```

## Variables de entorno

Ver [`.env.example`](.env.example) para la lista completa. Resumen:

| Variable                                                     | Descripción                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Proyecto Supabase, seguras de exponer al navegador (protegidas por RLS).      |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | **Solo servidor.** Nunca con prefijo `NEXT_PUBLIC_`, nunca en el cliente.     |
| `SMTP_*`, `EMAIL_*`                                          | Configuración de envío (ver [Correo](#correo-zimbra-y-plan-b-transaccional)). |
| `CRON_SECRET`                                                | Autoriza las llamadas de `pg_cron`/`pg_net` a `/api/jobs/*`.                  |
| `ALLOWED_EMAIL_DOMAIN`                                       | Dominio permitido para login (`grupolaar.com`).                               |

## Configuración de la aplicación

`config/app.config.ts` centraliza, tipado y validado con Zod, los valores
por defecto: datos de empresa/marca/contacto, formato de numeración de
prefacturas, formato del PDF, plantillas y ritmo de correo, patrones de
validación (placa, ODT), regla de duplicados y parámetros de período. La
tabla `configuracion` (clave/valor `jsonb`, ver migraciones) permite a un
ADMIN sobrescribir cualquiera de estos valores en runtime sin desplegar;
`src/lib/config/resolver.ts` hace el merge defaults + overrides en el
servidor.

## Base de datos y migraciones

Las migraciones SQL versionadas viven en `supabase/migrations/` y se aplican
con Supabase CLI:

```bash
supabase link --project-ref <tu-proyecto>
supabase db push
```

Incluyen: catálogos, maestros, tablas de importación (staging), operación
(ODT, prefacturas, descuentos), documentos y envíos, control/auditoría e
histórico — con RLS activado en todas las tablas, índices (incluido
`pg_trgm` para búsqueda por texto), triggers de auditoría, la secuencia de
correlativo sin huecos bajo concurrencia, los 4 buckets de Storage
(`imports`, `prefacturas`, `archivo`, `brand`) con sus políticas, y las
vistas `v_resumen_facturacion` / `v_total_facturacion` + la función
`match_escaneo()` para el módulo de escaneo. Ver el detalle de cada tabla en
los propios archivos de migración (comentados) y en
[`docs/arquitectura.md`](docs/arquitectura.md#3-modelo-de-datos-entidad-relación-simplificado).

**Modelo de roles (RLS).** `public.rol_actual()` resuelve el rol del usuario
autenticado desde `perfil_usuario` (creado automáticamente al registrarse,
con rol `CONSULTA` por defecto — un ADMIN debe promoverlo, ver
`supabase/seed.sql`). Las políticas siguen un patrón consistente:
`ADMIN` administra todo; `OPERADOR_TRANSPORTE` lee todo y escribe en las
tablas operativas (importación, ODT, prefacturas, PDFs, correo, novedades,
escaneo) pero no en catálogos/usuarios/configuración; `CONSULTA` solo lee.
Un usuario sin perfil activo no cumple ninguna política (deny-by-default).

Estas migraciones se han validado con un parser estático de SQL
(`libpg-query`, la gramática real de Postgres) para descartar errores de
sintaxis, pero **no se han ejecutado contra ninguna instancia real** — no
hay un proyecto Supabase conectado a este entorno. Ejecuta `supabase db
push` (o `supabase db reset` en local) contra un proyecto real antes de dar
por buena la fase 4 en producción.

## Seeds y migración de maestros

- `supabase/seed.sql` contiene los seeds de catálogos (regionales, períodos
  de ejemplo, tipo de ruta → centro de costo, calendario laborable, mapeo
  de columnas). Se ejecuta automáticamente con `supabase db reset`. Lo
  marcado como "EJEMPLO" en los comentarios del archivo debe reemplazarse
  por datos reales una vez migrada la hoja `DATA LIST` del `.xlsb`; lo
  marcado como "verificado" viene del diagnóstico preliminar confirmado.
- `scripts/migrar-maestros.ts` (fase 7, pendiente) migrará las hojas
  `VEHICULOS` y `BD CORREOS` del `.xlsb` real a las tablas `vehiculo`,
  `transportista`, `conductor` y `contacto_correo`, con reporte de
  conflictos.

## Ejecución local

Los **usuarios finales** (equipo de Transporte, PC Windows sin permisos de
administrador) solo usan el navegador contra el entorno desplegado — nunca
ejecutan nada localmente.

Para **desarrolladores**, Supabase local con Docker:

```bash
supabase start          # levanta Postgres + Auth + Storage + Studio local
supabase db reset       # aplica migraciones + seeds desde cero
npm run supabase:types  # regenera src/types/database.types.ts
npm run dev
```

## Pruebas

```bash
npm test            # Vitest (unitarias/integración)
npm run test:watch  # Vitest en modo watch
npm run test:e2e     # Playwright (requiere `npm run dev` o webServer automático)
```

Las pruebas de Vitest actuales cubren las funciones puras ya implementadas:
normalización de placa (`src/lib/validation/placa.ts`), limpieza de texto
oculto y parseo de fecha `dd/mm/aaaa` (`src/lib/validation/texto.ts`), y
asignación de período 13→12 (`src/lib/validation/periodo.ts`). El resto del
plan de pruebas (importación, correlativo concurrente, PDF, correo, RLS,
etc.) se agrega junto con cada módulo funcional.

## Generación de PDF

Implementado con `@react-pdf/renderer` (sin Chromium). La plantilla vive en
`src/pdf/templates/prefactura/` (`documento.tsx` + `estilos.ts` + `tipos.ts`),
separada de la lógica de negocio (`src/pdf/generar.ts`) y parametrizada por
`config/app.config.ts` (colores, contacto, leyenda, patrón de nombre de
archivo). `POST /api/prefacturas/:id/pdf` valida (RUC, razón social, al
menos 1 ODT, sin novedades ERROR abiertas), genera el PDF, lo sube a
Storage versionado (`prefacturas/{AAAA}/{MM}/{RUC}/{NUMERO}_v{version}.pdf`,
marcando la versión anterior `REEMPLAZADO`) y actualiza `documento_pdf` /
`prefactura`. `GET` del mismo endpoint devuelve una URL firmada de 5
minutos para ver/descargar el PDF vigente. Botones "Generar/Regenerar PDF"
y "Ver/descargar PDF" en `/prefacturas/:id`.

Sin fuente Metropolis autoalojada todavía (ver `public/brand/README.md`):
la plantilla usa Helvetica. Sin logo vectorial todavía: el encabezado usa
el nombre de la empresa en texto con la barra amarilla del brandbook, no
la imagen del logo — reemplazar por `Image` de `@react-pdf/renderer` en
cuanto `public/brand/logo-positivo.svg` exista.

**Verificación real de la librería**: se generó un PDF de prueba fuera del
proyecto (Document con 2 páginas, tabla de 40 filas, numeración de página
dinámica) usando exactamente la misma API que la plantilla real
(`Document`/`Page`/`View`/`Text`, `StyleSheet`, `fixed`, `render`
callback), ejecutado con Node ESM puro — el resultado fueron bytes de PDF
válidos (cabecera `%PDF-1.3`, trailer `%%EOF` correcto). Nota: la primera
prueba con `tsx` falló por una incompatibilidad de resolución de módulos
específica de esa herramienta con `@react-pdf/hyphenate` (un import ESM
estático que `tsx` resuelve mal); `next build` compila el mismo import sin
problema y Node ESM puro también, así que no afecta al build real de
Next.js/Vercel — se deja documentado por si vuelve a aparecer.

Ver el flujo completo en
[`docs/arquitectura.md`](docs/arquitectura.md#5-flujo-de-generación-de-pdf).

## Correo (Zimbra y plan B transaccional)

Implementado. `EmailProvider` (`src/lib/email/tipos.ts`) es una interfaz
intercambiable; hoy solo el adaptador `smtp` (`src/lib/email/providers/smtp.ts`,
Nodemailer) está implementado — `brevo`/`resend`/`ses` quedan como
adaptadores futuros y `EMAIL_PROVIDER` con cualquier otro valor falla con un
mensaje claro en vez de simular un envío. El envío corre en Route Handlers
y Server Actions con runtime Node.js por defecto (nunca en una Supabase
Edge Function, que bloquea los puertos 25/587/465).

**Qué puerto usar**: no se ha probado la conexión real contra Zimbra en
este entorno (no hay credenciales SMTP disponibles aquí). Al conectar por
primera vez contra el servidor real, probar `587` (STARTTLS,
`SMTP_SECURE=false`) primero y `465` (SSL, `SMTP_SECURE=true`) si el 587
no responde; documentar aquí cuál funcionó.

- **Envío individual**: formulario en `/prefacturas/:id` (correo principal
  precargado desde `contacto_correo`, agregar adicionales, asunto/cuerpo
  editable con variables `{PLACA} {RAZON_SOCIAL} {PERIODO} {NUMERO}
{TOTAL}`). Si la prefactura no tiene un PDF vigente, se genera antes de
  enviar (`src/pdf/generar-y-guardar.ts`, compartido con el botón
  "Generar PDF").
- **Envío masivo**: "Enviar seleccionados" en `/prefacturas` crea un
  `lote_proceso` y encola un `envio_correo` por prefactura (solo las que
  ya tienen PDF vigente y al menos un correo; el resto se cuenta como
  "omitidas"). `/prefacturas/lotes/:id` muestra el progreso en tiempo real
  vía Supabase Realtime (canal sobre `lote_proceso`/`envio_correo`; se
  habilitó la publicación `supabase_realtime` para ambas tablas en la
  migración `20260918090022`), con "Reintentar fallidos" y descarga del
  reporte de errores en Excel.
- **Cola**: `POST /api/jobs/email`, protegido con `CRON_SECRET`, reclama un
  lote con `tomar_lote_envio_correo()` (`FOR UPDATE SKIP LOCKED` dentro de
  una función Postgres, porque PostgREST no puede expresar ese patrón
  directo), respeta `EMAIL_RATE_PER_MINUTE` espaciando los envíos dentro
  del lote, y distingue errores permanentes (5xx SMTP) de temporales
  (reintenta con backoff exponencial hasta `EMAIL_MAX_RETRIES`).
- **Repositorio → Reenviar**: reutiliza el mismo encolado masivo (de-facto
  un lote de una sola prefactura) para no duplicar la lógica de envío.

## Modo prueba de correo

`EMAIL_TEST_MODE` (por defecto `true`, ver `src/lib/email/provider.ts` y
`.env.example`) redirige TODOS los correos a `EMAIL_TEST_RECIPIENT` y
antepone el destinatario real al asunto (`[PRUEBA → correo@real] ...`), sin
tocar el proveedor real. Debe estar activo hasta validar el flujo completo
antes del primer envío en producción.

## pg_cron

Migración `20260918090020_pg_cron_envio_correo.sql`: programa el job
`procesar-envio-correo` (cada minuto) que llama a `POST /api/jobs/email`
vía `pg_net.http_post`. Es un `DO $$ ... $$` defensivo: si `pg_cron`/`pg_net`
no están habilitados en el proyecto, no falla, solo avisa con
`raise notice`. **Antes de que tenga efecto real** hace falta, una sola vez
por proyecto:

```sql
-- 1. Habilitar extensiones (Database → Extensions en Supabase Studio, o):
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Configurar la URL pública de despliegue y el secreto compartido
--    (el mismo valor que CRON_SECRET en Vercel):
alter database postgres set app.settings.cron_url = 'https://tu-dominio.vercel.app';
alter database postgres set app.settings.cron_secret = 'el-mismo-valor-que-CRON_SECRET-en-Vercel';

-- 3. Volver a aplicar la migración (o ejecutar su bloque a mano) para que
--    cron.schedule() se registre con esos valores.
```

Para pausar/reanudar el job desde Supabase Studio: `select
cron.unschedule('procesar-envio-correo');` / volver a correr el bloque de
la migración. Ver el estado de ejecuciones en la tabla `cron.job_run_details`.

No se ha probado contra un proyecto Supabase real (no hay uno disponible en
este entorno); el SQL se verificó con un parser estático de Postgres, no
ejecutándolo.

## Despliegue

Vercel conectado a este repositorio de GitHub: preview automático por PR,
producción en `main`. GitHub Actions (`.github/workflows/ci.yml`) corre
lint, typecheck, format check y pruebas unitarias en cada PR. `supabase db
push` a producción se ejecuta manualmente (o vía Action dedicada, fase 16)
solo desde `main`.

## Política de archivo de períodos

Pendiente (fase 14/16). Un job archivará los períodos que excedan
`periodo.periodosCalientes` (configurable, por defecto 3) moviendo su
respaldo a `supabase/storage` bucket `archivo` y marcando `periodo.estado =
ARCHIVADO`; "Restaurar período" lo vuelve a dejar en modo consulta.

## Nota de seguridad: `xlsx` (SheetJS)

El paquete `xlsx` publicado en el registro de npm está congelado en `0.18.5`
y tiene dos vulnerabilidades conocidas sin parche en npm (prototype
pollution y ReDoS al parsear archivos maliciosos) — SheetJS solo publica
las versiones corregidas en su propio CDN (`cdn.sheetjs.com`), no en npm.
Mitigaciones aplicadas mientras tanto:

- Solo usuarios autenticados (`@grupolaar.com`) pueden subir archivos.
- Se valida extensión y tamaño antes de parsear (ver el paso "Cargar" del
  importador).
- El parseo de vista previa ocurre en un Web Worker aislado del hilo
  principal; la validación real ocurre en el servidor sobre datos ya
  tabulares (no se re-ejecuta el parser con permisos elevados).
- Si el entorno de despliegue permite acceso a `cdn.sheetjs.com`, se
  recomienda instalar la build oficial parcheada:
  `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` y fijar
  esa resolución en `overrides` del `package.json`.

## Solución de problemas

| Problema                                       | Causa probable                                                                                          | Solución                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SMTP rechaza la conexión o el puerto           | Firewall de Zimbra o puerto equivocado                                                                  | Confirmar con TI si es `587` (STARTTLS, `SMTP_SECURE=false`) o `465` (SSL, `SMTP_SECURE=true`). Nunca probar desde una Supabase Edge Function: usar un Route Handler (`runtime = "nodejs"`). |
| Correos llegan a spam                          | Falta SPF/DKIM/DMARC para `grupolaar.com`, o `EMAIL_FROM` no coincide con el dominio autenticado        | Pedir a TI que valide los registros DNS; considerar un proveedor transaccional (`EMAIL_PROVIDER=brevo/resend/ses`) como plan B.                                                              |
| Error 413 / límite de Vercel al subir el Excel | El archivo se está enviando por el body de la API en vez de subirse directo a Storage                   | Verificar que la subida use la URL firmada (`createSignedUploadUrl`), nunca un `POST` con el archivo en el body.                                                                             |
| "Storage lleno" o cuota excedida               | Bucket sin política de archivo o PDFs duplicados sin versionar                                          | Revisar `documento_pdf.estado = REEMPLAZADO` y la política de archivo de períodos; no se borran versiones, se archivan.                                                                      |
| "Período no encontrado" al importar            | El corte cae en un período que no existe en la tabla `periodo` (equivalente a que falte en `DATA LIST`) | Crear el período desde Configuración → Catálogos antes de reintentar la importación.                                                                                                         |
| "Placa inválida" persistente                   | La placa no cumple `^[A-Z]{3}[0-9]{4}$` ni se pudo extraer de `Chofer` con el patrón configurado        | Corregir manualmente la fila en el asistente de importación (paso Validar) o ajustar el patrón en Configuración si el formato de placas cambió.                                              |
