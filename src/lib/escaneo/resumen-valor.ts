import type { FilaMatch, ResumenValorEscaneo } from "./queries";

/**
 * Suma el valor de las filas de match_escaneo por categoría. Separado de
 * `obtenerMatchSesion` (que sí necesita Supabase) para poder probarlo sin
 * tocar la base de datos: es la cuenta que de verdad le importa al
 * operador, no basta con que las guías coincidan.
 */
export function calcularResumenValor(filas: Pick<FilaMatch, "resultado" | "valor">[]): ResumenValorEscaneo {
  const resumen: ResumenValorEscaneo = { totalEsperado: 0, totalConfirmado: 0, totalFaltante: 0 };
  for (const f of filas) {
    // Solo las esperadas para ESTA sesión (período/placa) cuentan para el
    // total: una guía de otra placa/período o que no existe en el sistema
    // no debería sumar al monto que se está validando aquí.
    if (f.resultado !== "ESCANEADA_Y_CARGADA" && f.resultado !== "CARGADA_SIN_FISICA") continue;
    const valor = f.valor ?? 0;
    resumen.totalEsperado += valor;
    if (f.resultado === "ESCANEADA_Y_CARGADA") resumen.totalConfirmado += valor;
    else resumen.totalFaltante += valor;
  }
  return resumen;
}
