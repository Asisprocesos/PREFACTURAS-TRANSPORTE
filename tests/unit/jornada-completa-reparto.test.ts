import { describe, expect, it } from "vitest";

import { repartirJornadaCompleta, type FilaResumenFacturacion } from "@/lib/prefacturas/resumen";

function fila(parcial: Partial<FilaResumenFacturacion>): FilaResumenFacturacion {
  return {
    centro_costo_final: null,
    regional: null,
    ruta_macro: null,
    cantidad: null,
    suma: null,
    valor_unitario_promedio: null,
    ...parcial,
  };
}

describe("repartirJornadaCompleta", () => {
  it("crea filas de Distribución y Recolección 50/50 cuando no existían", () => {
    const resultado = repartirJornadaCompleta([
      fila({
        centro_costo_final: "JORNADA COMPLETA",
        regional: "Machala",
        ruta_macro: "MCH CT2",
        cantidad: 1,
        suma: 64.53,
      }),
    ]);

    expect(resultado).toHaveLength(2);
    const distribucion = resultado.find((r) => r.centro_costo_final === "DISTRIBUCION");
    const recoleccion = resultado.find((r) => r.centro_costo_final === "RECOLECCION");
    expect(distribucion).toBeDefined();
    expect(recoleccion).toBeDefined();
    // La cantidad se suma ENTERA a ambos lados, no se fracciona.
    expect(distribucion?.cantidad).toBe(1);
    expect(recoleccion?.cantidad).toBe(1);
    // El monto sí se reparte, y la suma de ambas mitades da el total exacto.
    expect((distribucion?.suma ?? 0) + (recoleccion?.suma ?? 0)).toBeCloseTo(64.53, 2);
    expect(distribucion?.suma).toBeCloseTo(32.26, 2);
    expect(recoleccion?.suma).toBeCloseTo(32.27, 2);
  });

  it("suma el reparto a las filas de Distribución/Recolección existentes de la misma Regional+Ruta", () => {
    const resultado = repartirJornadaCompleta([
      fila({
        centro_costo_final: "DISTRIBUCION",
        regional: "Machala",
        ruta_macro: "MCH CT2",
        cantidad: 19,
        suma: 1163.46,
      }),
      fila({
        centro_costo_final: "JORNADA COMPLETA",
        regional: "Machala",
        ruta_macro: "MCH CT2",
        cantidad: 1,
        suma: 64.53,
      }),
    ]);

    expect(resultado).toHaveLength(2);
    const distribucion = resultado.find((r) => r.centro_costo_final === "DISTRIBUCION");
    const recoleccion = resultado.find((r) => r.centro_costo_final === "RECOLECCION");
    expect(distribucion?.cantidad).toBe(20);
    expect(distribucion?.suma).toBeCloseTo(1195.72, 2);
    expect(recoleccion?.cantidad).toBe(1);
    expect(recoleccion?.suma).toBeCloseTo(32.27, 2);
  });

  it("no toca filas de Regional+Ruta distintas de Jornada Completa", () => {
    const resultado = repartirJornadaCompleta([
      fila({
        centro_costo_final: "VIAJE REGIONAL",
        regional: "Machala",
        ruta_macro: "VR",
        cantidad: 1,
        suma: 64.53,
      }),
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.centro_costo_final).toBe("VIAJE REGIONAL");
  });

  it("reparte por separado cada combinación de Regional+Ruta", () => {
    const resultado = repartirJornadaCompleta([
      fila({
        centro_costo_final: "JORNADA COMPLETA",
        regional: "Machala",
        ruta_macro: "MCH CT2",
        cantidad: 1,
        suma: 100,
      }),
      fila({
        centro_costo_final: "JORNADA COMPLETA",
        regional: "Quito",
        ruta_macro: "QRO CT1",
        cantidad: 1,
        suma: 50,
      }),
    ]);
    expect(resultado).toHaveLength(4);
    const machala = resultado.filter((r) => r.regional === "Machala");
    const quito = resultado.filter((r) => r.regional === "Quito");
    expect(machala.map((r) => r.suma).sort()).toEqual([50, 50]);
    expect(quito.map((r) => r.suma).sort()).toEqual([25, 25]);
  });

  it("deja igual una fila sin Jornada Completa", () => {
    const filas = [fila({ centro_costo_final: "RECOLECCION", cantidad: 3, suma: 30 })];
    expect(repartirJornadaCompleta(filas)).toEqual(filas);
  });
});
