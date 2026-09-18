import { describe, expect, it } from "vitest";

import { transportistaFormSchema } from "@/lib/transportistas/schema";

describe("transportistaFormSchema", () => {
  it("acepta un RUC de 13 dígitos y razón social", () => {
    const r = transportistaFormSchema.safeParse({
      ruc: "1790012345001",
      razonSocial: "Transportes Ejemplo S.A.",
      activo: true,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un RUC con letras", () => {
    const r = transportistaFormSchema.safeParse({
      ruc: "179001234A001",
      razonSocial: "Transportes Ejemplo S.A.",
      activo: true,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza razón social vacía", () => {
    const r = transportistaFormSchema.safeParse({
      ruc: "1790012345001",
      razonSocial: "",
      activo: true,
    });
    expect(r.success).toBe(false);
  });
});
