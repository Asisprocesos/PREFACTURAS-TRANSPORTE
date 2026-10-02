import { z } from "zod";

export const tipoTransportistaSchema = z.object({
  nombre: z.string().trim().toUpperCase().min(1, "El nombre es obligatorio."),
  activo: z.boolean().default(true),
});

export type TipoTransportistaValues = z.infer<typeof tipoTransportistaSchema>;
