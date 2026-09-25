import { describe, expect, it } from "vitest";

import { categorizarNovedad, OPCIONES_CATEGORIA_NOVEDAD } from "@/lib/novedades/categorias";

describe("categorizarNovedad", () => {
  it("reconoce placa no registrada en Vehículos", () => {
    expect(categorizarNovedad("Placa ABC1234 no está registrada en Vehículos.")).toBe("placa_no_registrada");
  });

  it("reconoce placa recuperada desde Chofer", () => {
    expect(
      categorizarNovedad("Placa recuperada desde el campo Chofer (Placa original inválida o vacía)."),
    ).toBe("placa_recuperada_chofer");
  });

  it("reconoce Tipo de Ruta por revisar", () => {
    expect(categorizarNovedad('Tipo de Ruta "URBANA" por revisar (sin centro de costo asignado).')).toBe(
      "tipo_ruta_por_revisar",
    );
  });

  it("reconoce Tipo de Ruta vacío", () => {
    expect(categorizarNovedad("Tipo de Ruta vacío.")).toBe("tipo_ruta_vacio");
  });

  it("reconoce Tipo de Costo vacío", () => {
    expect(categorizarNovedad("Tipo de Costo vacío.")).toBe("tipo_costo_vacio");
  });

  it("reconoce valor en 0, negativo o vacío", () => {
    expect(categorizarNovedad("Valor en 0 o negativo.")).toBe("valor_cero_o_vacio");
    expect(categorizarNovedad("Valor vacío, se asume 0.")).toBe("valor_cero_o_vacio");
  });

  it("reconoce fecha de creación fuera del período", () => {
    expect(categorizarNovedad("Fecha Creación fuera del rango del período del corte.")).toBe(
      "fecha_fuera_rango",
    );
  });

  it("reconoce fecha con formato inválido (creación o recepción)", () => {
    expect(categorizarNovedad('Fecha Creación "31-13-2026" no tiene el formato dd/mm/aaaa.')).toBe(
      "fecha_formato_invalido",
    );
    expect(categorizarNovedad('Fecha Recepción "abc" no tiene el formato dd/mm/aaaa.')).toBe(
      "fecha_formato_invalido",
    );
  });

  it("reconoce estado distinto de Entregado", () => {
    expect(categorizarNovedad('Estado "En Ruta" distinto de Entregado: no se importa.')).toBe(
      "estado_no_entregado",
    );
  });

  it("devuelve 'otra' para mensajes desconocidos", () => {
    expect(categorizarNovedad("Un mensaje que no existe en el catálogo.")).toBe("otra");
  });

  it("incluye 'Otra' al final de las opciones", () => {
    expect(OPCIONES_CATEGORIA_NOVEDAD.at(-1)).toEqual({ id: "otra", etiqueta: "Otra" });
  });
});
