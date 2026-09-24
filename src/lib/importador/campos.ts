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

/**
 * Campos obligatorios que todavía no están mapeados a ninguna columna del
 * archivo. "estado" es el más crítico de los tres: es la columna que decide
 * qué filas se importan (solo "Entregado"); sin mapearla, todas las filas
 * quedarían excluidas en silencio en vez de fallar con un mensaje claro.
 * Compartido entre el wizard (bloquea "Validar") y `validarImportacionAction`
 * (frontera real, por si se llama sin pasar por la UI).
 */
export function camposObligatoriosFaltantes(mapeo: Record<string, CampoOdt | null>): CampoOdt[] {
  const mapeados = new Set(Object.values(mapeo).filter((c): c is CampoOdt => c !== null));
  return CAMPOS_OBLIGATORIOS.filter((c) => !mapeados.has(c));
}
