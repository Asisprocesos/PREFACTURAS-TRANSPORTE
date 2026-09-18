/**
 * Limpia caracteres ocultos producidos por Fénix al exportar celdas con
 * salto de línea (`_x000D_`, `\r`, `\n`) y normaliza espacios múltiples.
 * Ej.: "MCH CT2_x000D_\n TON 4.5" -> "MCH CT2 TON 4.5".
 */
export function limpiarTextoOculto(valor: string): string {
  return valor
    .replace(/_x000d_/gi, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Parsea una fecha en formato `dd/mm/aaaa` (texto, como la exporta Fénix)
 * a un objeto Date en UTC. Devuelve null si el formato no coincide.
 */
export function parsearFechaDdMmAaaa(valor: string): Date | null {
  const match = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, diaStr, mesStr, anioStr] = match;
  const dia = Number(diaStr);
  const mes = Number(mesStr);
  const anio = Number(anioStr);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return null;
  }
  return fecha;
}
