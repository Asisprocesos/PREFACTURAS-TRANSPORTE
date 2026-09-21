import { z } from "zod";

export const tipoRutaCentroCostoSchema = z.object({
  tipoRuta: z.string().trim().min(1, "El tipo de ruta es obligatorio."),
  centroCosto: z.string().trim().optional(),
  requiereRevision: z.boolean().default(false),
  activo: z.boolean().default(true),
});

export type TipoRutaCentroCostoValues = z.infer<typeof tipoRutaCentroCostoSchema>;
