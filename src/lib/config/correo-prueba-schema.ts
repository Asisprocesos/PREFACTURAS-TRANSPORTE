import { z } from "zod";

const listaCorreosSchema = z.string().refine(
  (valor) => {
    const partes = valor
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    return partes.every((correo) => z.string().email().safeParse(correo).success);
  },
  { message: "Hay un correo inválido en la lista (separa varios con coma)." },
);

export const correoPruebaSchema = z
  .object({
    modoPrueba: z.boolean(),
    destinatarioPrueba: listaCorreosSchema,
    destinatarioFallback: listaCorreosSchema,
  })
  .refine((datos) => !datos.modoPrueba || datos.destinatarioPrueba.trim() !== "", {
    message: "Con el modo prueba activado, el destinatario de prueba es obligatorio.",
    path: ["destinatarioPrueba"],
  });

export type CorreoPruebaValues = z.infer<typeof correoPruebaSchema>;
