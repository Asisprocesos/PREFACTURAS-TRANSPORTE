import { describe, expect, it } from "vitest";

import {
  filasErroresEnvio,
  filasPrefacturas,
  filasResumenCentroCosto,
  filasRezagos,
} from "@/lib/reportes/generar";
import type { NovedadFueraDePeriodo, PrefacturaReporte, PuntoMonto } from "@/lib/reportes/queries";

function prefactura(overrides: Partial<PrefacturaReporte>): PrefacturaReporte {
  return {
    id: "id-1",
    numero: "PF-2026-0001",
    periodo_id: "periodo-1",
    vehiculo_id: "vehiculo-1",
    transportista_id: "transportista-1",
    total_odt: 100,
    total_descuentos: 0,
    total: 100,
    cantidad_odt: 5,
    estado: "LISTA",
    version_actual: 0,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    created_by: null,
    vehiculo: { placa: "ABC1234" },
    transportista: { razon_social: "Transportes Demo", ruc: "1234567890001" },
    periodo: { nombre: "Período 13/08 - 12/09" },
    ...overrides,
  } as PrefacturaReporte;
}

describe("filasPrefacturas", () => {
  it("mapea número, placa, transportista y estado legible", () => {
    const filas = filasPrefacturas([prefactura({})]);
    expect(filas).toEqual([
      {
        Número: "PF-2026-0001",
        Período: "Período 13/08 - 12/09",
        Placa: "ABC1234",
        Transportista: "Transportes Demo",
        RUC: "1234567890001",
        "Cantidad ODT": 5,
        "Total ODT": 100,
        Descuentos: 0,
        Total: 100,
        Estado: "Lista",
      },
    ]);
  });

  it("usa '(sin número)' cuando la prefactura no tiene correlativo asignado", () => {
    const filas = filasPrefacturas([prefactura({ numero: null })]);
    expect(filas[0]?.["Número"]).toBe("(sin número)");
  });
});

describe("filasErroresEnvio", () => {
  it("filtra solo las prefacturas en ERROR_ENVIO e incluye el último error", () => {
    const listas = prefactura({ id: "id-listas", estado: "LISTA" });
    const conError = prefactura({ id: "id-error", estado: "ERROR_ENVIO" });
    const errores = new Map([["id-error", "SMTP rechazó el destinatario"]]);

    const filas = filasErroresEnvio([listas, conError], errores);

    expect(filas).toHaveLength(1);
    expect(filas[0]?.["Último error"]).toBe("SMTP rechazó el destinatario");
  });

  it("deja el error vacío si no hay registro en el mapa", () => {
    const conError = prefactura({ id: "id-error", estado: "ERROR_ENVIO" });
    const filas = filasErroresEnvio([conError], new Map());
    expect(filas[0]?.["Último error"]).toBe("");
  });
});

describe("filasResumenCentroCosto", () => {
  it("mapea centro de costo, cantidad y monto", () => {
    const datos: PuntoMonto[] = [{ nombre: "LOGISTICA", monto: 500.5, cantidad: 10 }];
    expect(filasResumenCentroCosto(datos)).toEqual([
      { "Centro de costo": "LOGISTICA", "Cantidad ODT": 10, Monto: 500.5 },
    ]);
  });
});

describe("filasRezagos", () => {
  function novedad(overrides: Partial<NovedadFueraDePeriodo>): NovedadFueraDePeriodo {
    return {
      id: "nov-1",
      placa: "ABC1234",
      transportista: "Transportes Demo",
      periodo: "Período 13/08 - 12/09",
      valor: 25.5,
      facturado: false,
      resolucion: null,
      estado: "ABIERTA",
      ...overrides,
    };
  }

  it("marca 'Pendiente de resolución' cuando la novedad sigue abierta sin resolución", () => {
    const filas = filasRezagos([novedad({})]);
    expect(filas[0]?.["Diferencias"]).toBe("Pendiente de resolución");
    expect(filas[0]?.["FACTURADO"]).toBe("No");
  });

  it("usa el texto de la resolución cuando ya fue resuelta", () => {
    const filas = filasRezagos([
      novedad({ estado: "RESUELTA", resolucion: "Se dejó como rezago.", facturado: true }),
    ]);
    expect(filas[0]?.["Diferencias"]).toBe("Se dejó como rezago.");
    expect(filas[0]?.["FACTURADO"]).toBe("Sí");
  });
});
