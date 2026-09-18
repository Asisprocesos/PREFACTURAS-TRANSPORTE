/**
 * Calcula el rango [inicio, fin] del período de facturación (por defecto
 * del día 13 al día 12 del mes siguiente) que contiene una fecha dada, y
 * el nombre del período con el formato del Excel original, ej.
 * "21-13-Aug-12-Sep".
 */

const MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface RangoPeriodo {
  inicio: Date;
  fin: Date;
  nombre: (numero: number) => string;
}

export function calcularRangoPeriodo(fecha: Date, diaInicio = 13, diaFin = 12): RangoPeriodo {
  const dia = fecha.getUTCDate();
  const mes = fecha.getUTCMonth();
  const anio = fecha.getUTCFullYear();

  let inicio: Date;
  let fin: Date;

  if (dia >= diaInicio) {
    inicio = new Date(Date.UTC(anio, mes, diaInicio));
    fin = new Date(Date.UTC(anio, mes + 1, diaFin));
  } else {
    inicio = new Date(Date.UTC(anio, mes - 1, diaInicio));
    fin = new Date(Date.UTC(anio, mes, diaFin));
  }

  return {
    inicio,
    fin,
    nombre: (numero: number) =>
      `${numero}-${diaInicio}-${MESES_EN[inicio.getUTCMonth()]}-${diaFin}-${MESES_EN[fin.getUTCMonth()]}`,
  };
}

export function fechaEnRango(fecha: Date, inicio: Date, fin: Date): boolean {
  return fecha.getTime() >= inicio.getTime() && fecha.getTime() <= fin.getTime();
}
