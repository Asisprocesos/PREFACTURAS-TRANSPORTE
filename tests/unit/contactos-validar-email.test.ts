import { describe, expect, it } from "vitest";

import { limpiarEmail } from "@/lib/contactos/validar-email";

describe("limpiarEmail", () => {
  it("acepta un correo válido tal cual", () => {
    expect(limpiarEmail("correo@dominio.com")).toBe("correo@dominio.com");
  });

  it("recorta un ';' pegado al final (el bug real: pasaba la validación vieja)", () => {
    expect(limpiarEmail("transportepesadojmg.sa@hotmail.com;")).toBe("transportepesadojmg.sa@hotmail.com");
  });

  it("recorta ',' y espacios sobrantes al inicio/fin", () => {
    expect(limpiarEmail("  correo@dominio.com, ")).toBe("correo@dominio.com");
    expect(limpiarEmail(";correo@dominio.com")).toBe("correo@dominio.com");
  });

  it("rechaza dos correos pegados sin separador limpio", () => {
    expect(limpiarEmail("a@x.com;b@y.com")).toBeNull();
  });

  it("rechaza texto sin arroba o vacío", () => {
    expect(limpiarEmail("no-es-un-correo")).toBeNull();
    expect(limpiarEmail("")).toBeNull();
    expect(limpiarEmail(undefined)).toBeNull();
  });
});
