import { describe, expect, it } from "vitest";

import {
  extraerPlacaNoRegistrada,
  extraerTipoRutaPorRevisar,
  mensajePlacaNoRegistrada,
  mensajeTipoRutaPorRevisar,
} from "@/lib/importador/mensajes";

describe("mensajes de importación (builder/extractor)", () => {
  it("reconoce placa no registrada en Vehículos", () => {
    const mensaje = mensajePlacaNoRegistrada("GSG9141");
    expect(extraerPlacaNoRegistrada(mensaje)).toBe("GSG9141");
  });

  it("reconoce tipo de ruta por revisar", () => {
    const mensaje = mensajeTipoRutaPorRevisar("URBANO EXPRESS");
    expect(extraerTipoRutaPorRevisar(mensaje)).toBe("URBANO EXPRESS");
  });

  it("no confunde mensajes distintos entre sí", () => {
    const mensaje = mensajePlacaNoRegistrada("GSG9141");
    expect(extraerTipoRutaPorRevisar(mensaje)).toBeNull();
  });

  it("devuelve null para texto que no matchea ningún patrón", () => {
    expect(extraerPlacaNoRegistrada("Falta la Guía (clave única de la ODT).")).toBeNull();
    expect(extraerTipoRutaPorRevisar("Falta la Guía (clave única de la ODT).")).toBeNull();
  });
});
