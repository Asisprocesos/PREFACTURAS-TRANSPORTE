/**
 * Textos de advertencia que apuntan a datos que viven en OTRO módulo (no en
 * la fila del staging): la placa no existe en Vehículos, el vehículo no
 * tiene correo, o el Tipo de Ruta no tiene Centro de Costo asignado en el
 * catálogo. `validar.ts` arma el mensaje con el builder; la UI del
 * importador usa el extractor correspondiente para reconocer esos mensajes
 * y mostrar un enlace directo a corregirlos, en vez de comparar strings a
 * mano en dos lugares (lo que se desincroniza fácil).
 */

export function mensajePlacaNoRegistrada(placa: string): string {
  return `Placa ${placa} no está registrada en Vehículos.`;
}

export function extraerPlacaNoRegistrada(mensaje: string): string | null {
  const m = mensaje.match(/^Placa (\S+) no está registrada en Vehículos\.$/);
  return m?.[1] ?? null;
}

export function mensajePlacaSinCorreo(placa: string): string {
  return `Placa ${placa} no tiene correo de contacto.`;
}

export function extraerPlacaSinCorreo(mensaje: string): string | null {
  const m = mensaje.match(/^Placa (\S+) no tiene correo de contacto\.$/);
  return m?.[1] ?? null;
}

export function mensajeTipoRutaPorRevisar(tipoRuta: string): string {
  return `Tipo de Ruta "${tipoRuta}" por revisar (sin centro de costo asignado).`;
}

export function extraerTipoRutaPorRevisar(mensaje: string): string | null {
  const m = mensaje.match(/^Tipo de Ruta "(.+)" por revisar \(sin centro de costo asignado\)\.$/);
  return m?.[1] ?? null;
}
