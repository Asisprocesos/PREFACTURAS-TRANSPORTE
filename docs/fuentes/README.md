# docs/fuentes/ — Archivos fuente pendientes

Esta carpeta debe contener los archivos originales que sirven de base para el
diagnóstico y las pruebas del importador. **Todavía no se han subido al
repositorio.** Coloca aquí, exactamente con estos nombres:

| Archivo | Descripción | Usado por |
|---|---|---|
| `CORTE_AL_12_DE_SEPTIEMBRE_2026.xlsx` | Reporte operativo de choferes exportado de Fénix (Reportes → Reporte Operativo → Choferes). ~15.170 filas × 15 columnas. | `scripts/analizar-excel.ts`, fixtures de importación, pruebas E2E. |
| `MACRO_CORTE_13_JUL_-_12_AGO.xlsb` | Archivo macro actual (~39 MB) con la lógica de negocio (hojas DATA LIST, BD, VEHICULOS, BD CORREOS, VALIDACION ODT, TD FACTURA, etc.). | `scripts/analizar-excel.ts`, `scripts/migrar-maestros.ts`, seeds de catálogos. |
| `IO-20304C_PREFACTURACION.pdf` | Instructivo del proceso actual de prefacturación. | Referencia de reglas de negocio; no se procesa por script. |
| `LAARCOURIER_BRANDBOOK_DE_MARCA_2023.pdf` | Brandbook: colores, tipografía, uso del logo, membrete. | Referencia de diseño (`docs/arquitectura.md`, plantilla PDF, tema Tailwind). |
| `LAARCOURIER_Aplicaciones_Logo.pdf` | Aplicaciones permitidas del logotipo. | Referencia de diseño. |

## Estado actual

`docs/diagnostico-excel.md` fue generado a partir del **diagnóstico
preliminar ya verificado** que el equipo de Transporte compartió sobre estos
archivos (estructura de columnas, novedades del corte, hojas del macro),
**no** de una ejecución real de `scripts/analizar-excel.ts`, porque los
archivos no están disponibles en este entorno.

## Qué hacer cuando subas los archivos reales

1. Copia los 5 archivos a esta carpeta con los nombres exactos de la tabla.
2. Ejecuta:
   ```bash
   npm run analizar:excel
   ```
3. Revisa el `docs/diagnostico-excel.md` regenerado y compáralo contra la
   versión actual (basada en el diagnóstico preliminar). Cualquier
   diferencia (columnas nuevas, formatos distintos, hojas adicionales) debe
   reflejarse en `config/app.config.ts`, la tabla `mapeo_columna` y los
   tests de Vitest correspondientes.
4. Copia una muestra anonimizada de ~500 filas a
   `tests/fixtures/corte-500-filas.xlsx` para las pruebas automatizadas
   (ver `docs/arquitectura.md`, sección Pruebas).
