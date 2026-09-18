import { z } from "zod";

export const transportistaFormSchema = z.object({
  ruc: z
    .string()
    .trim()
    .min(1, "El RUC es obligatorio.")
    .regex(/^\d{10,13}$/, "El RUC debe tener entre 10 y 13 dígitos."),
  razonSocial: z.string().trim().min(1, "La razón social es obligatoria."),
  tipoTransportista: z.string().trim().optional(),
  activo: z.boolean().default(true),
});

export type TransportistaFormValues = z.infer<typeof transportistaFormSchema>;
