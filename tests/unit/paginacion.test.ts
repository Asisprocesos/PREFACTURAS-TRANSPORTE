import { describe, expect, it } from "vitest";

import { construirPaginasVisibles } from "@/lib/paginacion";

describe("construirPaginasVisibles", () => {
  it("no muestra nada con 0 páginas y solo [1] con 1 página", () => {
    expect(construirPaginasVisibles(1, 0)).toEqual([]);
    expect(construirPaginasVisibles(1, 1)).toEqual([1]);
  });

  it("muestra todas las páginas sin '...' cuando entran en la ventana", () => {
    expect(construirPaginasVisibles(1, 4)).toEqual([1, 2, 3, 4]);
    expect(construirPaginasVisibles(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("agrega '...' al final cuando la página actual está cerca del inicio", () => {
    expect(construirPaginasVisibles(1, 12)).toEqual([1, 2, "...", 12]);
  });

  it("agrega '...' al inicio cuando la página actual está cerca del final", () => {
    expect(construirPaginasVisibles(12, 12)).toEqual([1, "...", 11, 12]);
  });

  it("agrega '...' en ambos lados cuando la página actual está en el medio", () => {
    expect(construirPaginasVisibles(6, 12)).toEqual([1, "...", 5, 6, 7, "...", 12]);
  });

  it("nunca duplica la página 1 ni la última cuando ya caen en la ventana", () => {
    expect(construirPaginasVisibles(2, 3)).toEqual([1, 2, 3]);
    expect(construirPaginasVisibles(2, 12)).toEqual([1, 2, 3, "...", 12]);
  });
});
