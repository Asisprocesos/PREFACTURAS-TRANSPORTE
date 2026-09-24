import { fechaEnRango } from "@/lib/validation/periodo";
import { normalizarPlaca } from "@/lib/validation/placa";
import { limpiarTextoOculto, parsearFechaDdMmAaaa } from "@/lib/validation/texto";

import type { CampoOdt } from "./campos";
import { mensajePlacaNoRegistrada, mensajePlacaSinCorreo, mensajeTipoRutaPorRevisar } from "./mensajes";

export interface ContextoValidacion {
  periodoInicio: Date;
  periodoFin: Date;
  /** Placas normalizadas (sin guion, mayúsculas) que existen en `vehiculo`. */
  placasConocidas: Set<string>;
  /** Placas normalizadas que tienen al menos un correo de contacto activo. */
  placasConCorreo: Set<string>;
  /** Tipo de ruta (normalizado) -> si requiere revisión / centro de costo. */
  tiposRuta: Map<string, { requiereRevision: boolean; centroCosto: string | null }>;
  /** Guías que ya existen en la tabla `odt` (de cualquier importación previa). */
  guiasExistentesBD: Set<string>;
  patronPlaca: string;
  patronExtraccionChofer: string;
}

export interface DatosNormalizadosOdt {
  guia: string;
  placaOriginal: string | null;
  placaNormalizada: string | null;
  chofer: string | null;
  ruta: string | null;
  rutaZona: string | null;
  detalleRuta: string | null;
  regionalOrigenTexto: string | null;
  regionalDestinoTexto: string | null;
  estadoFenix: string | null;
  fechaRecepcion: string | null;
  fechaCreacion: string | null;
  usuarioFenix: string | null;
  valor: number | null;
  tipoCosto: string | null;
  tipoRuta: string | null;
  corregida: boolean;
}

export interface FilaValidada {
  numeroFila: number;
  datosNormalizados: DatosNormalizadosOdt;
  errores: string[];
  advertencias: string[];
  /** Estado != Entregado: no se inserta y no cuenta como error. */
  excluida: boolean;
}

function normalizarTexto(v: string | undefined): string | null {
  if (!v) return null;
  const limpio = limpiarTextoOculto(v);
  return limpio === "" ? null : limpio;
}

function normalizarClave(v: string): string {
  return v.trim().toUpperCase();
}

/**
 * Valida y normaliza una fila ya mapeada a campos internos (`odt.*`). Pura:
 * no hace I/O. `guiasVistasEnArchivo` es el único parámetro con estado
 * mutable — el caller debe reusar el mismo Set para todas las filas del
 * mismo archivo, en orden, para detectar duplicados dentro del archivo.
 */
export function validarFila(
  numeroFila: number,
  fila: Partial<Record<CampoOdt, string>>,
  contexto: ContextoValidacion,
  guiasVistasEnArchivo: Set<string>,
): FilaValidada {
  const errores: string[] = [];
  const advertencias: string[] = [];

  const guia = (fila.guia ?? "").trim();
  if (!guia) {
    errores.push("Falta la Guía (clave única de la ODT).");
  }

  const estado = normalizarTexto(fila.estado);
  const excluida = (estado ?? "").toLowerCase() !== "entregado";
  if (excluida) {
    advertencias.push(`Estado "${estado ?? "(vacío)"}" distinto de Entregado: no se importa.`);
  }

  if (guia) {
    const claveGuia = normalizarClave(guia);
    if (guiasVistasEnArchivo.has(claveGuia)) {
      errores.push("Guía duplicada dentro del mismo archivo.");
    } else {
      guiasVistasEnArchivo.add(claveGuia);
    }
    if (contexto.guiasExistentesBD.has(claveGuia)) {
      errores.push("La guía ya existe en la base de datos (otra importación).");
    }
  }

  const fechaCreacionParsed = fila.fecha_creacion ? parsearFechaDdMmAaaa(fila.fecha_creacion) : null;
  if (!fila.fecha_creacion) {
    errores.push("Falta la Fecha Creación.");
  } else if (!fechaCreacionParsed) {
    errores.push(`Fecha Creación "${fila.fecha_creacion}" no tiene el formato dd/mm/aaaa.`);
  } else if (!fechaEnRango(fechaCreacionParsed, contexto.periodoInicio, contexto.periodoFin)) {
    advertencias.push("Fecha Creación fuera del rango del período del corte.");
  }

  const fechaRecepcionParsed = fila.fecha_recepcion ? parsearFechaDdMmAaaa(fila.fecha_recepcion) : null;
  if (fila.fecha_recepcion && !fechaRecepcionParsed) {
    advertencias.push(`Fecha Recepción "${fila.fecha_recepcion}" no tiene el formato dd/mm/aaaa.`);
  }

  let valor: number | null = null;
  if (fila.valor !== undefined && fila.valor !== "") {
    const n = Number(fila.valor.replace(/,/g, ""));
    if (Number.isNaN(n)) {
      errores.push(`Valor "${fila.valor}" no es numérico.`);
    } else {
      valor = n;
      if (n <= 0) advertencias.push("Valor en 0 o negativo.");
    }
  } else {
    advertencias.push("Valor vacío, se asume 0.");
    valor = 0;
  }

  const {
    placa: placaNormalizada,
    origen: origenPlaca,
    valida: placaValida,
  } = normalizarPlaca(fila.placa, fila.chofer, contexto.patronPlaca, contexto.patronExtraccionChofer);
  const corregida = origenPlaca === "chofer";

  if (!placaValida) {
    errores.push(
      placaNormalizada
        ? `Placa "${placaNormalizada}" no cumple el formato esperado.`
        : "No se pudo determinar la placa (vacía y no encontrada en Chofer).",
    );
  } else if (placaNormalizada) {
    if (!contexto.placasConocidas.has(placaNormalizada)) {
      advertencias.push(mensajePlacaNoRegistrada(placaNormalizada));
    } else if (!contexto.placasConCorreo.has(placaNormalizada)) {
      advertencias.push(mensajePlacaSinCorreo(placaNormalizada));
    }
  }
  if (corregida) {
    advertencias.push("Placa recuperada desde el campo Chofer (Placa original inválida o vacía).");
  }

  const tipoCosto = normalizarTexto(fila.tipo_costo);
  if (!tipoCosto) {
    advertencias.push("Tipo de Costo vacío.");
  }

  const tipoRuta = normalizarTexto(fila.tipo_ruta);
  if (tipoRuta) {
    const info = contexto.tiposRuta.get(tipoRuta.toUpperCase());
    if (!info || info.requiereRevision || !info.centroCosto) {
      advertencias.push(mensajeTipoRutaPorRevisar(tipoRuta));
    }
  } else {
    advertencias.push("Tipo de Ruta vacío.");
  }

  return {
    numeroFila,
    datosNormalizados: {
      guia,
      placaOriginal: normalizarTexto(fila.placa),
      placaNormalizada: placaValida ? placaNormalizada : null,
      chofer: normalizarTexto(fila.chofer),
      ruta: normalizarTexto(fila.ruta),
      rutaZona: normalizarTexto(fila.ruta_zona),
      detalleRuta: normalizarTexto(fila.detalle_ruta),
      regionalOrigenTexto: normalizarTexto(fila.regional_origen),
      regionalDestinoTexto: normalizarTexto(fila.regional_destino),
      estadoFenix: estado,
      fechaRecepcion: fechaRecepcionParsed ? fechaRecepcionParsed.toISOString().slice(0, 10) : null,
      fechaCreacion: fechaCreacionParsed ? fechaCreacionParsed.toISOString().slice(0, 10) : null,
      usuarioFenix: normalizarTexto(fila.usuario_fenix),
      valor,
      tipoCosto,
      tipoRuta,
      corregida,
    },
    errores,
    advertencias,
    excluida,
  };
}
