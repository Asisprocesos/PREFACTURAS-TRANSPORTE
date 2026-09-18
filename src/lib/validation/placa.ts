/**
 * Normalización de placa según la regla de negocio (IO-20304C):
 * mayúsculas, sin guiones ni espacios. Si el resultado no cumple el patrón
 * configurado, se intenta extraer la placa desde el campo `Chofer`
 * (ej. "ABEL VELEZ GSG-9141").
 */

export interface ResultadoNormalizacionPlaca {
  placa: string | null;
  origen: "placa" | "chofer" | null;
  valida: boolean;
}

function limpiar(valor: string): string {
  return valor.toUpperCase().replace(/[-\s]/g, "");
}

export function normalizarPlaca(
  placaOriginal: string | null | undefined,
  chofer: string | null | undefined,
  patronPlaca: string,
  patronExtraccionChofer: string,
): ResultadoNormalizacionPlaca {
  const regexPlaca = new RegExp(patronPlaca);

  const placaLimpia = placaOriginal ? limpiar(placaOriginal) : "";
  if (placaLimpia && regexPlaca.test(placaLimpia)) {
    return { placa: placaLimpia, origen: "placa", valida: true };
  }

  if (chofer) {
    const regexChofer = new RegExp(patronExtraccionChofer);
    const match = chofer.match(regexChofer);
    if (match) {
      const desdeChofer = limpiar(match[0]);
      if (regexPlaca.test(desdeChofer)) {
        return { placa: desdeChofer, origen: "chofer", valida: true };
      }
      return { placa: desdeChofer, origen: "chofer", valida: false };
    }
  }

  return { placa: placaLimpia || null, origen: placaLimpia ? "placa" : null, valida: false };
}
