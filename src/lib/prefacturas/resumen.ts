export interface FilaResumenFacturacion {
  centro_costo_final: string | null;
  regional: string | null;
  ruta_macro: string | null;
  cantidad: number | null;
  suma: number | null;
  valor_unitario_promedio: number | null;
}

const CENTRO_JORNADA_COMPLETA = "JORNADA COMPLETA";
const CENTRO_DISTRIBUCION = "DISTRIBUCION";
const CENTRO_RECOLECCION = "RECOLECCION";

function claveGrupo(f: {
  regional: string | null;
  ruta_macro: string | null;
  centro_costo_final: string | null;
}) {
  return `${f.regional ?? ""}|${f.ruta_macro ?? ""}|${f.centro_costo_final ?? ""}`;
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

/**
 * Jornada Completa no es un centro de costo que use el área de facturación
 * — contablemente esa ODT hizo tanto recolección como distribución, así que
 * en el resumen (no en el Detalle de ODT, que sigue mostrando el centro de
 * costo real de cada ODT) su monto se reparte 50/50 entre Distribución y
 * Recolección de la misma Regional + Ruta, sumándose a esas filas si ya
 * existían. La cantidad de ODT se suma ENTERA a ambos lados (no se
 * fracciona 0.5/0.5): cada ODT de Jornada Completa cuenta como una unidad
 * completa de cada tarea.
 */
export function repartirJornadaCompleta(filas: FilaResumenFacturacion[]): FilaResumenFacturacion[] {
  const resultado: FilaResumenFacturacion[] = [];
  const indice = new Map<string, FilaResumenFacturacion>();

  for (const f of filas) {
    if ((f.centro_costo_final ?? "").trim().toUpperCase() === CENTRO_JORNADA_COMPLETA) continue;
    const copia = { ...f };
    resultado.push(copia);
    indice.set(claveGrupo(copia), copia);
  }

  for (const f of filas) {
    if ((f.centro_costo_final ?? "").trim().toUpperCase() !== CENTRO_JORNADA_COMPLETA) continue;
    const cantidad = f.cantidad ?? 0;
    const suma = f.suma ?? 0;
    // Redondeo a centavos en dos partes que suman exacto el total original,
    // en vez de la mitad dos veces (que podría perder/ganar un centavo).
    const centavosTotales = Math.round(suma * 100);
    const mitadDistribucion = Math.floor(centavosTotales / 2) / 100;
    const mitadRecoleccion = (centavosTotales - Math.floor(centavosTotales / 2)) / 100;

    for (const [centro, monto] of [
      [CENTRO_DISTRIBUCION, mitadDistribucion],
      [CENTRO_RECOLECCION, mitadRecoleccion],
    ] as const) {
      const base = { regional: f.regional, ruta_macro: f.ruta_macro, centro_costo_final: centro };
      const clave = claveGrupo(base);
      const existente = indice.get(clave);
      if (existente) {
        existente.cantidad = (existente.cantidad ?? 0) + cantidad;
        existente.suma = redondear((existente.suma ?? 0) + monto);
        existente.valor_unitario_promedio = existente.cantidad
          ? redondear(existente.suma / existente.cantidad)
          : 0;
      } else {
        const nueva: FilaResumenFacturacion = {
          centro_costo_final: centro,
          regional: f.regional,
          ruta_macro: f.ruta_macro,
          cantidad,
          suma: redondear(monto),
          valor_unitario_promedio: cantidad ? redondear(monto / cantidad) : 0,
        };
        resultado.push(nueva);
        indice.set(clave, nueva);
      }
    }
  }

  return resultado;
}
