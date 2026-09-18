import { describe, expect, it } from "vitest";

import { limpiarTextoOculto, parsearFechaDdMmAaaa } from "@/lib/validation/texto";

describe("limpiarTextoOculto", () => {
  it("elimina _x000D_ y saltos de línea del caso real de Fénix", () => {
    expect(limpiarTextoOculto("MCH CT2_x000D_\n TON 4.5")).toBe("MCH CT2 TON 4.5");
  });

  it("colapsa espacios múltiples", () => {
    expect(limpiarTextoOculto("A   B\r\nC")).toBe("A B C");
  });

  it("no altera texto ya limpio", () => {
    expect(limpiarTextoOculto("RUTA NORMAL")).toBe("RUTA NORMAL");
  });
});

describe("parsearFechaDdMmAaaa", () => {
  it("parsea una fecha válida dd/mm/aaaa", () => {
    const fecha = parsearFechaDdMmAaaa("13/08/2026");
    expect(fecha?.toISOString().slice(0, 10)).toBe("2026-08-13");
  });

  it("devuelve null para un formato inválido", () => {
    expect(parsearFechaDdMmAaaa("2026-08-13")).toBeNull();
  });

  it("devuelve null para una fecha imposible (31 de febrero)", () => {
    expect(parsearFechaDdMmAaaa("31/02/2026")).toBeNull();
  });
});
