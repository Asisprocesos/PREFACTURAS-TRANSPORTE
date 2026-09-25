import { describe, expect, it } from "vitest";

import { calcularResumenValor } from "@/lib/escaneo/resumen-valor";

describe("calcularResumenValor", () => {
  it("suma lo confirmado y lo faltante por separado, y el esperado es la suma de ambos", () => {
    const resumen = calcularResumenValor([
      { resultado: "ESCANEADA_Y_CARGADA", valor: 100 },
      { resultado: "ESCANEADA_Y_CARGADA", valor: 50 },
      { resultado: "CARGADA_SIN_FISICA", valor: 30 },
    ]);
    expect(resumen).toEqual({ totalEsperado: 180, totalConfirmado: 150, totalFaltante: 30 });
  });

  it("ignora ESCANEADA_NO_CARGADA y OTRA_PLACA_O_PERIODO (no son parte de lo esperado en esta sesión)", () => {
    const resumen = calcularResumenValor([
      { resultado: "ESCANEADA_Y_CARGADA", valor: 100 },
      { resultado: "ESCANEADA_NO_CARGADA", valor: null },
      { resultado: "OTRA_PLACA_O_PERIODO", valor: 9999 },
    ]);
    expect(resumen).toEqual({ totalEsperado: 100, totalConfirmado: 100, totalFaltante: 0 });
  });

  it("trata valor null como 0 sin romper la suma", () => {
    const resumen = calcularResumenValor([{ resultado: "CARGADA_SIN_FISICA", valor: null }]);
    expect(resumen).toEqual({ totalEsperado: 0, totalConfirmado: 0, totalFaltante: 0 });
  });

  it("devuelve todo en 0 para una lista vacía", () => {
    expect(calcularResumenValor([])).toEqual({ totalEsperado: 0, totalConfirmado: 0, totalFaltante: 0 });
  });
});
