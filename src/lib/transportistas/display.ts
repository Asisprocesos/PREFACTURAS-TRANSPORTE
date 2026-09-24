/**
 * El nombre comercial es el que se muestra como "Transportista" en el
 * resto del sistema; los transportistas creados antes de que existiera
 * este campo no lo tienen, así que se usa la razón social como respaldo.
 */
export function nombreTransportista(t: { nombre?: string | null; razon_social: string } | null | undefined) {
  return t?.nombre?.trim() || t?.razon_social || null;
}

/**
 * Un RUC ecuatoriano válido tiene 13 dígitos (cédula/ID de 10 + "001" de
 * establecimiento). Algunos IDs empiezan con 0 y Excel los guarda sin ese
 * cero al importar, dejando el RUC guardado con 12 dígitos. Como corregir
 * esto transportista por transportista no es viable con el volumen actual,
 * se completa con el cero al mostrarlo (sin tocar el dato guardado).
 */
export function completarRuc(ruc: string | null | undefined): string {
  const valor = (ruc ?? "").trim();
  return /^\d{12}$/.test(valor) ? `0${valor}` : valor;
}
