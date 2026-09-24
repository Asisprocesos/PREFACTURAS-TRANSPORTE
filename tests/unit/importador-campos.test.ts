import { describe, expect, it } from "vitest";

import { camposObligatoriosFaltantes } from "@/lib/importador/campos";

describe("camposObligatoriosFaltantes", () => {
  it("no falta nada cuando Guía, Fecha Creación y Estado están mapeados", () => {
    const mapeo = { GUIA: "guia", FECHA: "fecha_creacion", ESTADO: "estado", RUTA: "ruta" } as const;
    expect(camposObligatoriosFaltantes(mapeo)).toEqual([]);
  });

  it('detecta que falta "estado" cuando ninguna columna se mapea a él', () => {
    const mapeo = { GUIA: "guia", FECHA: "fecha_creacion", ESTADO_FENIX: null } as const;
    expect(camposObligatoriosFaltantes(mapeo)).toEqual(["estado"]);
  });

  it("detecta varios campos obligatorios faltantes a la vez", () => {
    expect(camposObligatoriosFaltantes({})).toEqual(["guia", "fecha_creacion", "estado"]);
  });
});
