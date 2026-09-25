import { extraerPlacaNoRegistrada, extraerTipoRutaPorRevisar } from "@/lib/importador/mensajes";

/**
 * `novedad.tipo` siempre vale el literal 'IMPORTACION' (así lo escribe
 * `confirmar_importacion_lote()`), así que no sirve para distinguir el tipo
 * real de la novedad. La única fuente de esa información es el texto libre
 * de `novedad.mensaje`, que a su vez es siempre uno de los textos que arma
 * `validarFila()` en src/lib/importador/validar.ts. Este módulo categoriza
 * ese texto para poder filtrar por "tipo de novedad" en Control por placa.
 */

export interface CategoriaNovedad {
  id: string;
  etiqueta: string;
}

interface DefinicionCategoria extends CategoriaNovedad {
  coincide: (mensaje: string) => boolean;
}

const CATEGORIAS: DefinicionCategoria[] = [
  {
    id: "placa_no_registrada",
    etiqueta: "Placa no registrada en Vehículos",
    coincide: (m) => extraerPlacaNoRegistrada(m) !== null,
  },
  {
    id: "placa_recuperada_chofer",
    etiqueta: "Placa recuperada del campo Chofer",
    coincide: (m) => m === "Placa recuperada desde el campo Chofer (Placa original inválida o vacía).",
  },
  {
    id: "tipo_ruta_por_revisar",
    etiqueta: "Tipo de Ruta por revisar (sin centro de costo)",
    coincide: (m) => extraerTipoRutaPorRevisar(m) !== null,
  },
  {
    id: "tipo_ruta_vacio",
    etiqueta: "Tipo de Ruta vacío",
    coincide: (m) => m === "Tipo de Ruta vacío.",
  },
  {
    id: "tipo_costo_vacio",
    etiqueta: "Tipo de Costo vacío",
    coincide: (m) => m === "Tipo de Costo vacío.",
  },
  {
    id: "valor_cero_o_vacio",
    etiqueta: "Valor en cero, negativo o vacío",
    coincide: (m) => m === "Valor en 0 o negativo." || m === "Valor vacío, se asume 0.",
  },
  {
    id: "fecha_fuera_rango",
    etiqueta: "Fecha Creación fuera del período",
    coincide: (m) => m === "Fecha Creación fuera del rango del período del corte.",
  },
  {
    id: "fecha_formato_invalido",
    etiqueta: "Fecha con formato inválido",
    coincide: (m) => /^Fecha (Creación|Recepción) ".*" no tiene el formato dd\/mm\/aaaa\.$/.test(m),
  },
  {
    id: "estado_no_entregado",
    etiqueta: 'Estado distinto de "Entregado"',
    coincide: (m) => /^Estado ".*" distinto de Entregado: no se importa\.$/.test(m),
  },
];

/** Categoría de reserva para mensajes que no calzan con ningún patrón conocido. */
const ID_OTRA = "otra";

export function categorizarNovedad(mensaje: string): string {
  return CATEGORIAS.find((c) => c.coincide(mensaje))?.id ?? ID_OTRA;
}

export const OPCIONES_CATEGORIA_NOVEDAD: CategoriaNovedad[] = [
  ...CATEGORIAS.map(({ id, etiqueta }) => ({ id, etiqueta })),
  { id: ID_OTRA, etiqueta: "Otra" },
];
