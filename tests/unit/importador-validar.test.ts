import { describe, expect, it } from "vitest";

import { validarFila, type ContextoValidacion } from "@/lib/importador/validar";

const PATRON_PLACA = "^[A-Z]{3}[0-9]{4}$";
const PATRON_CHOFER = "[A-Z]{3}-?\\d{3,4}";

function contextoBase(overrides: Partial<ContextoValidacion> = {}): ContextoValidacion {
  return {
    periodoInicio: new Date(Date.UTC(2026, 7, 13)),
    periodoFin: new Date(Date.UTC(2026, 8, 12)),
    placasConocidas: new Set(["GSG9141"]),
    placasConCorreo: new Set(["GSG9141"]),
    tiposRuta: new Map([["DISTRIBUCION", { requiereRevision: false, centroCosto: "DISTRIBUCION" }]]),
    guiasExistentesBD: new Set(),
    patronPlaca: PATRON_PLACA,
    patronExtraccionChofer: PATRON_CHOFER,
    ...overrides,
  };
}

const filaValidaBase = {
  guia: "ODTLC00000001",
  placa: "GSG9141",
  chofer: "ABEL VELEZ GSG-9141",
  estado: "Entregado",
  fecha_creacion: "20/08/2026",
  valor: "15.5",
  tipo_costo: "FLETE",
  tipo_ruta: "DISTRIBUCION",
};

describe("validarFila — caso válido", () => {
  it("no genera errores ni advertencias con una fila completa y correcta", () => {
    const r = validarFila(1, filaValidaBase, contextoBase(), new Set());
    expect(r.errores).toEqual([]);
    expect(r.advertencias).toEqual([]);
    expect(r.excluida).toBe(false);
    expect(r.datosNormalizados.placaNormalizada).toBe("GSG9141");
    expect(r.datosNormalizados.valor).toBe(15.5);
  });
});

describe("validarFila — Estado", () => {
  it("marca como excluida (advertencia, no error) cuando Estado != Entregado", () => {
    const r = validarFila(1, { ...filaValidaBase, estado: "Anulado" }, contextoBase(), new Set());
    expect(r.excluida).toBe(true);
    expect(r.errores).toEqual([]);
    expect(r.advertencias.some((a) => a.includes("Anulado"))).toBe(true);
  });
});

describe("validarFila — duplicados", () => {
  it("detecta guía duplicada dentro del mismo archivo", () => {
    const vistas = new Set<string>();
    validarFila(1, filaValidaBase, contextoBase(), vistas);
    const r2 = validarFila(2, filaValidaBase, contextoBase(), vistas);
    expect(r2.errores).toContain("Guía duplicada dentro del mismo archivo.");
  });

  it("detecta guía ya existente en la base de datos", () => {
    const contexto = contextoBase({ guiasExistentesBD: new Set(["ODTLC00000001"]) });
    const r = validarFila(1, filaValidaBase, contexto, new Set());
    expect(r.errores).toContain("La guía ya existe en la base de datos (otra importación).");
  });
});

describe("validarFila — placa", () => {
  it("advierte cuando la placa no está en Vehículos", () => {
    const contexto = contextoBase({ placasConocidas: new Set(), placasConCorreo: new Set() });
    const r = validarFila(1, filaValidaBase, contexto, new Set());
    expect(r.advertencias.some((a) => a.includes("no está registrada en Vehículos"))).toBe(true);
  });

  it("advierte cuando la placa no tiene correo", () => {
    const contexto = contextoBase({ placasConCorreo: new Set() });
    const r = validarFila(1, filaValidaBase, contexto, new Set());
    expect(r.advertencias.some((a) => a.includes("no tiene correo"))).toBe(true);
  });

  it("recupera la placa desde Chofer y lo marca como corregida", () => {
    const r = validarFila(1, { ...filaValidaBase, placa: "" }, contextoBase(), new Set());
    expect(r.datosNormalizados.placaNormalizada).toBe("GSG9141");
    expect(r.datosNormalizados.corregida).toBe(true);
    expect(r.advertencias.some((a) => a.includes("recuperada desde el campo Chofer"))).toBe(true);
  });
});

describe("validarFila — valor", () => {
  it("advierte cuando el valor es 0", () => {
    const r = validarFila(1, { ...filaValidaBase, valor: "0" }, contextoBase(), new Set());
    expect(r.advertencias).toContain("Valor en 0 o negativo.");
  });
});

describe("validarFila — fecha fuera de corte", () => {
  it("advierte cuando Fecha Creación cae fuera del período (caso real: 07/08 en corte 13/08-12/09)", () => {
    const r = validarFila(1, { ...filaValidaBase, fecha_creacion: "07/08/2026" }, contextoBase(), new Set());
    expect(r.advertencias).toContain("Fecha Creación fuera del rango del período del corte.");
  });
});

describe("validarFila — tipo de ruta", () => {
  it("advierte con REEMPLAZO TRANSPORTE (sin centro de costo asignado)", () => {
    const r = validarFila(
      1,
      { ...filaValidaBase, tipo_ruta: "REEMPLAZO TRANSPORTE" },
      contextoBase(),
      new Set(),
    );
    expect(r.advertencias.some((a) => a.includes("por revisar"))).toBe(true);
  });
});
