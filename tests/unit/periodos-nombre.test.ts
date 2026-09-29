import { describe, expect, it } from "vitest";

import { calcularSiguienteRango, construirNombrePeriodo } from "@/lib/periodos/nombre";

describe("construirNombrePeriodo", () => {
  it("arma el nombre número-día-mes-día-mes con abreviaturas en español", () => {
    expect(construirNombrePeriodo(4, "2026-10-13", "2026-11-12")).toBe("4-13-Oct-12-Nov");
    expect(construirNombrePeriodo(1, "2026-07-13", "2026-08-12")).toBe("1-13-Jul-12-Ago");
  });
});

describe("calcularSiguienteRango", () => {
  it("sugiere el día siguiente como inicio y un mes después como fin", () => {
    expect(calcularSiguienteRango("2026-10-12")).toEqual({
      fechaInicio: "2026-10-13",
      fechaFin: "2026-11-12",
    });
  });

  it("cruza correctamente el fin de año", () => {
    expect(calcularSiguienteRango("2026-12-12")).toEqual({
      fechaInicio: "2026-12-13",
      fechaFin: "2027-01-12",
    });
  });
});
