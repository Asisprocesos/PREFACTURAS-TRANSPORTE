const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Limpia y valida un correo suelto de datos importados (Excel de
 * Vehículos/Transportistas). Recorta espacios y separadores sobrantes al
 * inicio/fin (";", ",") antes de validar el formato — sin esto, una celda
 * como "correo@dominio.com;" pasaba la validación anterior (el regex viejo
 * no excluía ";" del carácter válido) y quedaba guardada tal cual; el
 * proveedor SMTP la rechaza como destinatario inválido en el envío.
 * Devuelve null si, ya limpio, no es un correo válido.
 */
export function limpiarEmail(valor: unknown): string | null {
  const sinBordes = String(valor ?? "")
    .trim()
    .replace(/^[;,\s]+|[;,\s]+$/g, "");
  return sinBordes && REGEX_EMAIL.test(sinBordes) ? sinBordes : null;
}
