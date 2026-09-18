import { z } from "zod";

export const correoFormSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
  tipo: z.enum(["PRINCIPAL", "ADICIONAL"]).default("ADICIONAL"),
});

export type CorreoFormValues = z.infer<typeof correoFormSchema>;
