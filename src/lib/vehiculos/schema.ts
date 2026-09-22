import { z } from "zod";

import { defaultAppConfig } from "@/config/app.config";

const numeroOpcional = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
  z.number().positive().optional(),
);

export const vehiculoFormSchema = z.object({
  placa: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/[-\s]/g, ""))
    .refine((v) => new RegExp(defaultAppConfig.patrones.placa).test(v), {
      message: "La placa no cumple el formato configurado (ej. ABC1234).",
    }),
  transportistaId: z.string().uuid().optional().or(z.literal("")),
  propietario: z.string().trim().optional(),
  rucPropietario: z
    .string()
    .trim()
    .regex(/^\d{10,13}$/, "El RUC debe tener entre 10 y 13 dígitos.")
    .optional()
    .or(z.literal("")),
  marca: z.string().trim().optional(),
  modelo: z.string().trim().optional(),
  anio: numeroOpcional,
  tonelaje: numeroOpcional,
  tipoVehiculo: z.string().trim().optional(),
  largo: numeroOpcional,
  alto: numeroOpcional,
  ancho: numeroOpcional,
  cubicaje: numeroOpcional,
  regionalId: z.string().uuid().optional().or(z.literal("")),
  activo: z.boolean().default(true),
});

export type VehiculoFormValues = z.infer<typeof vehiculoFormSchema>;
