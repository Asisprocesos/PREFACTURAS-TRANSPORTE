import { z } from "zod";

export const cuentaCorreoSchema = z.object({
  cuentaActiva: z.enum(["PRINCIPAL", "RESPALDO"]),
  limiteDiario: z.coerce.number().int().positive(),
});

export type CuentaCorreoValues = z.infer<typeof cuentaCorreoSchema>;
