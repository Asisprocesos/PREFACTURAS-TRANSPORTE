import { describe, expect, it } from "vitest";

import { transportistaFormSchema } from "@/lib/transportistas/schema";

describe("transportistaFormSchema", () => {
  it("acepta un RUC de 13 dígitos, razón social y nombre", () => {
    const r = transportistaFormSchema.safeParse({
      ruc: "1790012345001",
      razonSocial: "Transportes Ejemplo S.A.",
      nombre: "Transportes Ejemplo",
      activo: true,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un RUC con letras", () => {
    const r = transportistaFormSchema.safeParse({
      ruc: "179001234A001",
      razonSocial: "Transportes Ejemplo S.A.",
      nombre: "Transportes Ejemplo",
      activo: true,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza razón social vacía", () => {
    const r = transportistaFormSchema.safeParse({
      ruc: "1790012345001",
      razonSocial: "",
      nombre: "Transportes Ejemplo",
      activo: true,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza nombre vacío", () => {
    const r = transportistaFormSchema.safeParse({
      ruc: "1790012345001",
      razonSocial: "Transportes Ejemplo S.A.",
      nombre: "",
      activo: true,
    });
    expect(r.success).toBe(false);
  });
});
