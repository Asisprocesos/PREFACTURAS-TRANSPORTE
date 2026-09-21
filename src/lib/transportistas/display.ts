/**
 * El nombre comercial es el que se muestra como "Transportista" en el
 * resto del sistema; los transportistas creados antes de que existiera
 * este campo no lo tienen, así que se usa la razón social como respaldo.
 */
export function nombreTransportista(t: { nombre?: string | null; razon_social: string } | null | undefined) {
  return t?.nombre?.trim() || t?.razon_social || null;
}
