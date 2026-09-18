# Diagnóstico de archivos Excel

> **Origen de este documento.** Los archivos reales (`docs/fuentes/CORTE_AL_12_DE_SEPTIEMBRE_2026.xlsx`,
> `docs/fuentes/MACRO_CORTE_13_JUL_-_12_AGO.xlsb`) no están presentes en este
> repositorio/entorno. Este diagnóstico se construyó a partir del
> **diagnóstico preliminar ya verificado** que el equipo de Transporte aportó
> sobre esos archivos. `scripts/analizar-excel.ts` está listo para regenerar
> esta misma estructura de documento automáticamente en cuanto los archivos
> se suban a `docs/fuentes/` (`npm run analizar:excel`) — en ese momento este
> documento debe compararse contra la versión regenerada y corregirse
> cualquier diferencia. Ver `docs/fuentes/README.md`.

## 1. Archivo del corte (Fénix) — `CORTE_AL_12_DE_SEPTIEMBRE_2026.xlsx`

**Hoja:** `Reporte_Choferes{fecha}` (nombre de hoja variable por fecha de
descarga → el importador **no debe depender del nombre de la hoja**, el
usuario la elige en el paso "Leer" del asistente).

**Dimensión:** 15.170 filas de datos × 15 columnas. Encabezado en la fila 1
(sin filas vacías previas detectadas en este archivo, pero el detector de
encabezado debe tolerarlas porque otros cortes pueden traer una fila de
título).

### Columnas

| # | Columna | Tipo | Notas |
|---|---|---|---|
| 1 | Chofer | texto | Incluye la placa con guion al final, ej. `"ABEL VELEZ GSG-9141"`. Fuente de respaldo para extraer placa cuando `Placa` es inválida. |
| 2 | Ruta | texto | Contiene retornos de carro ocultos `_x000D_\n` / `\r\n` (ej. `"MCH CT2_x000D_\n TON 4.5"`). Requiere limpieza. |
| 3 | Regional Origen | texto | Catálogo `regional`. |
| 4 | Guía | texto/numérico | **Clave única de ODT** (`odt.guia`). |
| 5 | Estado | texto | Solo se importan filas con `Estado = Entregado`; el resto se reporta como advertencia y no se inserta. |
| 6 | Fecha Recepción | texto `dd/mm/aaaa` | Parsear a `date`. |
| 7 | Valor | numérico | 41 filas en `0` en este corte → advertencia, no error bloqueante. |
| 8 | Tipo de Costo | texto | 31 filas vacías en este corte → advertencia. |
| 9 | Tipo de Ruta | texto | Se cruza contra `tipo_ruta_centro_costo`. 4 filas con `REEMPLAZO TRANSPORTE` requieren reclasificación manual/asistida. |
| 10 | Ruta/Zona | texto | **Alias de `Ruta-Zona`** (nombre usado en el `.xlsb`). Caso de prueba obligatorio del mapeo de columnas (`mapeo_columna`). También puede traer `_x000D_`/`\r\n`. |
| 11 | Placa | texto | Sin guion, ej. `GSG9141`. 1 fila vacía en este corte. Si no cumple `^[A-Z]{3}[0-9]{4}$` tras normalizar, se extrae de `Chofer`. |
| 12 | Regional Destino | texto | Catálogo `regional`. |
| 13 | Fecha Creación | texto `dd/mm/aaaa` | Determina el período (13→12) de la ODT. 9 filas en este corte caen fuera del rango 13/08–12/09 (desde el 07/08) → novedad "fecha fuera de corte" con las 4 alternativas de resolución (mover, rezago, excluir, corregir). |
| 14 | Usuario | texto | Usuario Fénix que creó el registro (`odt.usuario_fenix`), solo trazabilidad. |
| 15 | Detalle de la Ruta | texto | Texto libre adicional. |

### Novedades confirmadas en el corte de referencia

- 1 fila con `Placa` vacía → recuperar desde `Chofer` o marcar error corregible.
- 41 ODT con `Valor = 0` → advertencia (no bloquea inserción, sí genera `novedad`).
- 31 ODT sin `Tipo de Costo` → advertencia.
- 9 ODT con `Fecha Creación` fuera de 13/08–12/09 (desde 07/08) → novedad "fuera de corte".
- 4 ODT con `Tipo de Ruta = REEMPLAZO TRANSPORTE` → novedad "tipo de ruta por revisar", requiere reclasificación de centro de costo.
- Hoja auxiliar `Hoja3`: lista de placas "no hay en base" (no están en el maestro `VEHICULOS`). Se usa para prevalidar antes de insertar.

### Caracteres ocultos y limpieza

`Ruta` y `Ruta/Zona` contienen secuencias `_x000D_\n` y/o `\r\n` producidas
por Fénix al exportar celdas con salto de línea. El normalizador debe:
`texto.replace(/_x000D_/gi, "").replace(/[\r\n]+/g, " ").trim().replace(/\s+/g, " ")`.

## 2. Archivo macro — `MACRO_CORTE_13_JUL_-_12_AGO.xlsb` (~39 MB)

| Hoja | Función | Tablas/objetos destino |
|---|---|---|
| **DATA LIST** | Catálogos: períodos (`#`, INICIO, FIN, nombre `20-13-Jul-12-Aug`); rutas principales → RUTA MACRO, TARIFA, KM, HORAS VIAJE; Tipo de Ruta → MACRO (CORE/TEMU) → CENTRO DE COSTOS; calendario FECHA → DÍA TEXTO → LABORABLE. | `periodo`, `ruta_macro`, `tipo_ruta_centro_costo`, `calendario` |
| **BD** | Base acumulada de ODT + columnas calculadas P:AJ (RUTA MACRO, Placa real, REGISTRO, CONDUCTOR, PROVEEDOR, FACTURADO, # FACTURA, DESCUENTO, TIPO DE RUTA 3, Tipo V. SIS, CORE-TEMU, PERIODO DE FAC, DÍA/MES/AÑO/SEMANA, LABORABLE, VAL COSTO, DIFERENCIA, FECHA). | `odt` + derivaciones calculadas en servidor al importar |
| **VEHICULOS** | Maestro de placas: PlacasVehículo, Contratista, Propietario, Conductor, Marca, Modelo, Año, Tonelaje, Tipo Vehículo, Largo/Alto/Ancho, Cubicaje, Regional, Tipo Transportista, RUC, CORREO. | `vehiculo`, `transportista`, `conductor` |
| **BD CORREOS** | Placa → ESTADO (SI/NO TIENE CORREO) → CORREOS separados por `;` (con duplicados) → CONTRATISTA. | `contacto_correo` (1 fila por correo, deduplicado) |
| **REG / REGIONAL** | Catálogo de regionales. | `regional` |
| **PREFACTURA** | Placas únicas del período + validador + botones de envío/PDF. | Módulo Prefacturas + Control por placa |
| **VALIDACION ODT** | Por placa: cabecera (PLACA, RAZÓN SOCIAL, RUC, FACTURA, VALOR FACTURA, VALIDACIÓN, VALOR ODTs), matriz RESUMEN CENTRO DE COSTO × REGIONAL, detalle de ODT, cruce ODT MANUAL. | Pantalla "Validación ODT" + escaneo de ODT físicas |
| **ODT VARIAS PLACAS** | ODT asociadas a más de una placa o sin placa. | Regla de duplicado "ODT en varias placas" |
| **DETALLE POR PLACAS / REPORTE DET. X PLACA** | Filtro período+placa, con subtotal. | Vista detalle de prefactura + reporte exportable |
| **TD FACTURA** | "RESUMEN FACTURACIÓN": CENTRO DE COSTO FINAL, REGIONAL, RUTA, VALOR FINAL, CANTIDAD, SUMA, Total general. | Página 2 del PDF (`v_resumen_facturacion`) |
| **REZAGOS** | PROVEEDOR, Placa, PERIODO DE FAC, Valor, FACTURADO, Diferencias. | Reporte de rezagos |
| **BD VAL FACT / ENTR. FACT.** | Conciliación con factura real del transportista. | `factura_transportista` (fase posterior) |
| **DESCUENTOS** | ITEM, FECHA, descuentos aplicados. | `descuento` |
| Hoja1–7, TD, TD V PLAC, TD PIEZA, BD PC | Tablas dinámicas de análisis. | No se replican como hojas; se cubren con Reportes y Dashboard. |

### Inconsistencia de nombres de columna confirmada

`Ruta-Zona` (macro `.xlsb`) ↔ `Ruta/Zona` (Fénix `.xlsx`) — mismo campo,
nombre distinto según el origen. Es el caso de prueba obligatorio de
`mapeo_columna` (tabla de alias configurable desde la UI, sin tocar código).

## 3. Proceso actual (IO-20304C) a automatizar

1. Descargar reporte de Fénix con corte del día 13 del mes anterior al 12 del
   mes en curso.
2. Filtrar `Estado = Entregado`.
3. Limpiar `Placa`: quitar guiones/espacios, validar longitud 7; si inválida,
   tomar del campo `Chofer`.
4. Pegar en BD y extender fórmulas P:AJ (→ derivaciones automáticas en
   servidor al importar).
5. Verificar que el período del corte exista en `DATA LIST` (→ tabla
   `periodo`; si no existe, error bloqueante configurable).
6. Reclasificar `Tipo de Ruta = REEMPLAZO TRANSPORTE` por centro de costo.
7. Filtrar período, obtener placas únicas, validar contra `VEHICULOS` y
   `BD CORREOS`.
8. Por placa: cargar razón social/RUC/valor factura/resumen/detalle,
   actualizar `TD FACTURA`, generar PDF `PLACA - RUC.pdf`, guardar, enviar
   con asunto `Prefactura Disponible - Vehículo {PLACA}`.

## 4. Modelo de datos: ajustes tras el diagnóstico

El modelo propuesto por el usuario (ver `docs/arquitectura.md`, sección
Modelo de datos) se mantiene sin cambios estructurales; los siguientes
puntos deben reflejarse en las migraciones y en la validación:

- `odt.ruta_zona` se alimenta indistintamente de `Ruta/Zona` o `Ruta-Zona`
  vía `mapeo_columna` — no se crean dos columnas.
- `odt.placa_original` guarda el valor crudo de `Placa` (o el extraído de
  `Chofer` cuando `Placa` es inválida/vacía); `odt.placa_normalizada` guarda
  el resultado de aplicar la regex de negocio. `odt.corregida = true` cuando
  la placa se recuperó desde `Chofer`.
- `odt.tipo_ruta = 'REEMPLAZO TRANSPORTE'` sin `centro_costo_final` resuelto
  se inserta igual (no es un error, es una advertencia) pero genera
  `novedad` tipo "tipo de ruta por revisar" con acción sugerida de
  reclasificación masiva.
- `Hoja3` (placas "no hay en base") no se migra como tabla: es el resultado
  en tiempo real de cruzar `odt.placa_normalizada` contra `vehiculo.placa`,
  ya cubierto por el módulo "Control por placa".

## 5. Próximo paso cuando existan los archivos reales

```bash
# 1. Copiar los archivos a docs/fuentes/ (ver docs/fuentes/README.md)
# 2. Regenerar el diagnóstico real:
npm run analizar:excel
# 3. Diff manual contra este documento y ajustar mapeo_columna / validaciones
#    si aparecen columnas, hojas o formatos no contemplados aquí.
```
