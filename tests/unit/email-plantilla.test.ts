import { describe, expect, it } from "vitest";

import { interpolarPlantilla } from "@/lib/email/plantilla";

describe("interpolarPlantilla", () => {
  const variables = {
    PLACA: "GSG9141",
    RAZON_SOCIAL: "Transportes Ejemplo S.A.",
    PERIODO: "2-13-Aug-12-Sep",
    NUMERO: "PF-2026-000123",
    TOTAL: "$1,234.56",
  };

  it("reemplaza todas las variables conocidas", () => {
    const resultado = interpolarPlantilla(
      "Prefactura Disponible - Vehículo {PLACA} ({NUMERO}) por {TOTAL}",
      variables,
    );
    expect(resultado).toBe("Prefactura Disponible - Vehículo GSG9141 (PF-2026-000123) por $1,234.56");
  });

  it("deja intacto un placeholder desconocido", () => {
    const resultado = interpolarPlantilla("Hola {DESCONOCIDO}", variables);
    expect(resultado).toBe("Hola {DESCONOCIDO}");
  });

  it("no falla con texto sin placeholders", () => {
    expect(interpolarPlantilla("Texto normal", variables)).toBe("Texto normal");
  });
});
