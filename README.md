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

| Fase                       | Contenido                                                                                  | Estado                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1. Diagnóstico             | `docs/diagnostico-excel.md`, `scripts/analizar-excel.ts`                                   | ✅ Hecho (basado en diagnóstico preliminar; falta re-ejecutar con los archivos reales, ver `docs/fuentes/README.md`) |
| 2. Arquitectura            | `docs/arquitectura.md`                                                                     | ✅ Hecho                                                                                                             |
| 3. Estructura del proyecto | Next.js 15, Tailwind, shadcn/ui-style, Vitest, Playwright, ESLint, Prettier, CI            | ✅ Hecho                                                                                                             |
| 4. Base de datos           | `supabase/migrations/`, RLS, índices, triggers, seeds                                      | ✅ Hecho (migraciones y seeds versionados; **no aplicadas** contra ningún proyecto Supabase real todavía)            |
| 5. Autenticación y roles   | Supabase Auth, restricción `@grupolaar.com`, `perfil_usuario`                              | ⏳ Esquema de roles y RLS listos en migraciones; falta la UI de gestión de usuarios (fase 15)                        |
| 6–16. Módulos funcionales  | Transportistas, Vehículos, Importador, Prefacturas, PDF, Correo, Dashboard, Reportes, etc. | ⏳ Pendiente                                                                                                         |

Cada fase, al completarse, se documenta con: qué se implementó, qué archivos
se crearon, qué decisiones técnicas se tomaron, cómo probarlo y qué falta —
ver el historial de commits (`git log`) y los mensajes de cada commit.

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
`pg_trgm` para búsqueda por texto), triggers de auditoría y la secuencia de
correlativo sin huecos bajo concurrencia. Ver el detalle de cada tabla en
los propios archivos de migración (comentados) y en
[`docs/arquitectura.md`](docs/arquitectura.md#3-modelo-de-datos-entidad-relación-simplificado).

## Seeds y migración de maestros

- `supabase/seed/` contiene los seeds de catálogos (períodos, rutas macro,
  tipo de ruta → centro de costo, calendario, regionales) derivados de la
  hoja `DATA LIST` del macro `.xlsb`, según el diagnóstico preliminar.
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

Pendiente (fase 10). Se implementará con `@react-pdf/renderer` (sin
Chromium) en `src/pdf/templates/prefactura/`, separada de la lógica de
negocio y parametrizada por `config/app.config.ts`. Ver el flujo completo en
[`docs/arquitectura.md`](docs/arquitectura.md#5-flujo-de-generación-de-pdf).

## Correo (Zimbra y plan B transaccional)

Pendiente (fase 12). El envío SMTP se hará desde Route Handlers con
`export const runtime = "nodejs"` (las Edge Functions de Supabase bloquean
los puertos 25/587/465). En la primera prueba de conexión real contra
Zimbra se debe documentar aquí qué puerto funcionó: `587` (STARTTLS) o
`465` (SSL). `EmailProvider` es una interfaz intercambiable
(`smtp` | `brevo` | `resend` | `ses`, ver `EMAIL_PROVIDER`).

## Modo prueba de correo

`EMAIL_TEST_MODE=true` (valor por defecto en `config/app.config.ts`)
redirige todos los correos a `EMAIL_TEST_RECIPIENT` en lugar del
destinatario real. Debe estar activo hasta validar el flujo completo antes
del primer envío en producción.

## pg_cron

Pendiente (fase 12/14). Se configurará con una migración SQL
(`cron.schedule`) que invoca `pg_net.http_post` hacia `/api/jobs/email` cada
minuto, con el header `Authorization: Bearer ${CRON_SECRET}`. Se documentará
aquí el nombre exacto del job y cómo pausarlo/reanudarlo desde Supabase
Studio.

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
