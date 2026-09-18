/**
 * Campos internos de `odt` que el importador puede poblar, y sus
 * encabezados de origen "razonables" por defecto (se usan solo como
 * sugerencia inicial del paso Mapear; la fuente de verdad configurable es
 * la tabla `mapeo_columna`, ver src/lib/importador/mapeo.ts).
 */
export const CAMPOS_ODT = [
  "guia",
  "chofer",
  "ruta",
  "regional_origen",
  "estado",
  "fecha_recepcion",
  "valor",
  "tipo_costo",
  "tipo_ruta",
  "ruta_zona",
  "placa",
  "regional_destino",
  "fecha_creacion",
  "usuario_fenix",
  "detalle_ruta",
] as const;

export type CampoOdt = (typeof CAMPOS_ODT)[number];

export const ETIQUETA_CAMPO: Record<CampoOdt, string> = {
  guia: "Guía",
  chofer: "Chofer",
  ruta: "Ruta",
  regional_origen: "Regional Origen",
  estado: "Estado",
  fecha_recepcion: "Fecha Recepción",
  valor: "Valor",
  tipo_costo: "Tipo de Costo",
  tipo_ruta: "Tipo de Ruta",
  ruta_zona: "Ruta/Zona",
  placa: "Placa",
  regional_destino: "Regional Destino",
  fecha_creacion: "Fecha Creación",
  usuario_fenix: "Usuario",
  detalle_ruta: "Detalle de la Ruta",
};

export const CAMPOS_OBLIGATORIOS: CampoOdt[] = ["guia", "fecha_creacion", "estado"];
