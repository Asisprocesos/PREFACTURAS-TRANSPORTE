import { describe, expect, it } from "vitest";

import { calcularRangoPeriodo, fechaEnRango } from "@/lib/validation/periodo";

describe("calcularRangoPeriodo", () => {
  it("asigna al período 13-Aug-12-Sep una fecha del 20 de agosto", () => {
    const { inicio, fin, nombre } = calcularRangoPeriodo(new Date(Date.UTC(2026, 7, 20)));
    expect(inicio.toISOString().slice(0, 10)).toBe("2026-08-13");
    expect(fin.toISOString().slice(0, 10)).toBe("2026-09-12");
    expect(nombre(21)).toBe("21-13-Aug-12-Sep");
  });

  it("asigna al período anterior una fecha del 5 de agosto (antes del día 13)", () => {
    const { inicio, fin } = calcularRangoPeriodo(new Date(Date.UTC(2026, 7, 5)));
    expect(inicio.toISOString().slice(0, 10)).toBe("2026-07-13");
    expect(fin.toISOString().slice(0, 10)).toBe("2026-08-12");
  });

  it("maneja el cambio de año (diciembre -> enero)", () => {
    const { inicio, fin, nombre } = calcularRangoPeriodo(new Date(Date.UTC(2026, 0, 5)));
    expect(inicio.toISOString().slice(0, 10)).toBe("2025-12-13");
    expect(fin.toISOString().slice(0, 10)).toBe("2026-01-12");
    expect(nombre(1)).toBe("1-13-Dec-12-Jan");
  });
});

describe("fechaEnRango", () => {
  it("detecta una fecha fuera del corte (como las 9 ODT del diagnóstico)", () => {
    const inicio = new Date(Date.UTC(2026, 7, 13));
    const fin = new Date(Date.UTC(2026, 8, 12));
    const fechaFueraDeCorte = new Date(Date.UTC(2026, 7, 7));
    expect(fechaEnRango(fechaFueraDeCorte, inicio, fin)).toBe(false);
  });
});
