import { describe, expect, it } from "vitest";

import { completarRuc } from "@/lib/transportistas/display";

describe("completarRuc", () => {
  it("agrega un 0 inicial a un RUC de 12 dígitos", () => {
    expect(completarRuc("751145481001")).toBe("0751145481001");
  });

  it("deja igual un RUC de 13 dígitos", () => {
    expect(completarRuc("0751145481001")).toBe("0751145481001");
  });

  it("no toca valores con otra longitud o con letras", () => {
    expect(completarRuc("12345")).toBe("12345");
    expect(completarRuc("75114548100A")).toBe("75114548100A");
  });

  it("devuelve vacío para null/undefined", () => {
    expect(completarRuc(null)).toBe("");
    expect(completarRuc(undefined)).toBe("");
  });
});
