const MESES_ABREV = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatoFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function abreviarFecha(fechaISO: string): string {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  return `${fecha.getUTCDate()}-${MESES_ABREV[fecha.getUTCMonth()]}`;
}

/** Arma el nombre estilo "4-13-Oct-12-Nov" (número-día-mes-día-mes) a partir del rango. */
export function construirNombrePeriodo(numero: number, fechaInicio: string, fechaFin: string): string {
  return `${numero}-${abreviarFecha(fechaInicio)}-${abreviarFecha(fechaFin)}`;
}

/**
 * Sugiere el rango del siguiente período (13→12, ver comentario en la tabla
 * `periodo`): arranca el día después de que termina el último período
 * registrado y cierra un mes después. Es solo una sugerencia editable en el
 * formulario — no asume que todos los períodos duran exactamente un mes.
 */
export function calcularSiguienteRango(ultimaFechaFin: string): { fechaInicio: string; fechaFin: string } {
  const inicio = new Date(`${ultimaFechaFin}T00:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() + 1);

  const fin = new Date(inicio);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  fin.setUTCDate(fin.getUTCDate() - 1);

  return { fechaInicio: formatoFecha(inicio), fechaFin: formatoFecha(fin) };
}
