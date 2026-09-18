import { describe, expect, it } from "vitest";

import { normalizarPlaca } from "@/lib/validation/placa";

const PATRON_PLACA = "^[A-Z]{3}[0-9]{4}$";
const PATRON_CHOFER = "[A-Z]{3}-?\\d{3,4}";

describe("normalizarPlaca", () => {
  it("normaliza una placa válida quitando guion", () => {
    const r = normalizarPlaca("GSG-9141", "ABEL VELEZ GSG-9141", PATRON_PLACA, PATRON_CHOFER);
    expect(r).toEqual({ placa: "GSG9141", origen: "placa", valida: true });
  });

  it("acepta una placa ya sin guion", () => {
    const r = normalizarPlaca("GSG9141", null, PATRON_PLACA, PATRON_CHOFER);
    expect(r.valida).toBe(true);
    expect(r.placa).toBe("GSG9141");
  });

  it("recupera la placa desde Chofer cuando Placa está vacía", () => {
    const r = normalizarPlaca("", "ABEL VELEZ GSG-9141", PATRON_PLACA, PATRON_CHOFER);
    expect(r).toEqual({ placa: "GSG9141", origen: "chofer", valida: true });
  });

  it("recupera la placa desde Chofer cuando Placa es inválida", () => {
    const r = normalizarPlaca("GSG91", "ABEL VELEZ GSG-9141", PATRON_PLACA, PATRON_CHOFER);
    expect(r.origen).toBe("chofer");
    expect(r.valida).toBe(true);
    expect(r.placa).toBe("GSG9141");
  });

  it("marca como inválida cuando ni Placa ni Chofer producen una placa válida", () => {
    const r = normalizarPlaca("", "CONDUCTOR SIN PLACA", PATRON_PLACA, PATRON_CHOFER);
    expect(r.valida).toBe(false);
    expect(r.placa).toBeNull();
  });
});
