import { z } from "zod";

/**
 * Configuración central de la aplicación, tipada y validada con Zod.
 *
 * Estos son los valores por defecto (versionados en código). La tabla
 * `configuracion` (clave/valor jsonb) permite a un ADMIN sobrescribir
 * cualquiera de estos valores en runtime sin desplegar. La fusión
 * defaults + overrides ocurre en `resolverConfiguracion()` (servidor).
 */

export const contactoSchema = z.object({
  quito: z.string(),
  guayaquil: z.string(),
  telefono: z.string(),
  sitioWeb: z.string().url(),
});

export const empresaSchema = z.object({
  nombre: z.string(),
  nombreDocumento: z.string(),
  logoPositivo: z.string(),
  logoNegativo: z.string(),
  logoGris: z.string(),
  iconoFavicon: z.string(),
  colores: z.object({
    amarillo: z.string(),
    negro: z.string(),
    gris: z.string(),
    sidebar: z.string(),
  }),
  contacto: contactoSchema,
});

export const numeracionSchema = z.object({
  /** Placeholders soportados: {AÑO}, {SECUENCIA} */
  formato: z.string(),
  digitosSecuencia: z.number().int().positive(),
  reinicioAnual: z.boolean(),
});

export const pdfSchema = z.object({
  tamanoPagina: z.enum(["A4", "Letter"]),
  margenes: z.object({
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
    left: z.number(),
  }),
  /** Placeholder soportado: {PLACA}, {RUC} */
  nombreArchivo: z.string(),
  leyenda: z.string(),
});

export const correoTemplateSchema = z.object({
  /** Variables: {PLACA} {RAZON_SOCIAL} {PERIODO} {NUMERO} {TOTAL} */
  asunto: z.string(),
  cuerpo: z.string(),
});

export const correoSchema = z.object({
  from: z.string(),
  replyTo: z.string().optional(),
  ritmoPorMinuto: z.number().int().positive(),
  tamanoLote: z.number().int().positive(),
  maxReintentos: z.number().int().nonnegative(),
  modoPrueba: z.boolean(),
  destinatarioPrueba: z.string().email().optional(),
  plantillaIndividual: correoTemplateSchema,
  plantillaMasiva: correoTemplateSchema,
});

export const patronesSchema = z.object({
  placa: z.string(), // regex, ej. ^[A-Z]{3}[0-9]{4}$
  extraccionPlacaDesdeChofer: z.string(), // regex, ej. [A-Z]{3}-?\d{3,4}
  odt: z.string(), // regex, ej. ODTLC\d{8}
});

export const duplicadosSchema = z.object({
  claveOdt: z.array(z.enum(["guia", "placa", "fecha_creacion"])),
  clavePrefactura: z.array(z.enum(["vehiculo_id", "periodo_id", "transportista_id"])),
});

export const periodoSchema = z.object({
  diaInicio: z.number().int().min(1).max(31),
  diaFin: z.number().int().min(1).max(31),
  /** Nº de períodos recientes que permanecen "calientes" (editables) antes de archivarse */
  periodosCalientes: z.number().int().positive(),
});

export const appConfigSchema = z.object({
  empresa: empresaSchema,
  numeracion: numeracionSchema,
  pdf: pdfSchema,
  correo: correoSchema,
  patrones: patronesSchema,
  duplicados: duplicadosSchema,
  periodo: periodoSchema,
  dominioCorreoPermitido: z.string(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export const defaultAppConfig: AppConfig = {
  empresa: {
    nombre: "LAARCOURIER",
    nombreDocumento: "Prefactura",
    logoPositivo: "/brand/logo-positivo.svg",
    logoNegativo: "/brand/logo-negativo.svg",
    logoGris: "/brand/logo-gris.svg",
    iconoFavicon: "/brand/icono-lce.svg",
    colores: {
      amarillo: "#FCE200",
      negro: "#000000",
      gris: "#E1E1E1",
      sidebar: "#1D1D1B",
    },
    contacto: {
      quito: "De los Cipreses lote 26 y De las Avellanas, Quito",
      guayaquil: "Km 11½ vía Daule, Bodegas Verdeloma, Guayaquil",
      telefono: "(02) 396 0000",
      sitioWeb: "https://www.laarcourier.com",
    },
  },
  numeracion: {
    formato: "PF-{AÑO}-{SECUENCIA}",
    digitosSecuencia: 6,
    reinicioAnual: true,
  },
  pdf: {
    tamanoPagina: "A4",
    margenes: { top: 36, right: 36, bottom: 36, left: 36 },
    nombreArchivo: "{PLACA} - {RUC}.pdf",
    leyenda: "Documento no tributario – Prefactura",
  },
  correo: {
    from: "Prefacturación Transporte LAARCOURIER <transporteprefactura@grupolaar.com>",
    ritmoPorMinuto: 10,
    tamanoLote: 20,
    maxReintentos: 3,
    modoPrueba: true,
    plantillaIndividual: {
      asunto: "Prefactura Disponible - Vehículo {PLACA}",
      cuerpo:
        "Estimado transportista,\n\nAdjuntamos la prefactura {NUMERO} correspondiente al período {PERIODO} " +
        "del vehículo {PLACA}, por un total de {TOTAL}.\n\nSaludos,\nEquipo de Transporte — LAARCOURIER",
    },
    plantillaMasiva: {
      asunto: "Prefactura Disponible - Vehículo {PLACA}",
      cuerpo:
        "Estimado {RAZON_SOCIAL},\n\nAdjuntamos la prefactura {NUMERO} correspondiente al período {PERIODO} " +
        "del vehículo {PLACA}, por un total de {TOTAL}.\n\nSaludos,\nEquipo de Transporte — LAARCOURIER",
    },
  },
  patrones: {
    placa: "^[A-Z]{3}[0-9]{4}$",
    extraccionPlacaDesdeChofer: "[A-Z]{3}-?\\d{3,4}",
    odt: "^ODTLC\\d{8}$",
  },
  duplicados: {
    claveOdt: ["guia"],
    clavePrefactura: ["vehiculo_id", "periodo_id"],
  },
  periodo: {
    diaInicio: 13,
    diaFin: 12,
    periodosCalientes: 3,
  },
  dominioCorreoPermitido: "grupolaar.com",
};

// Valida en tiempo de carga del módulo que los defaults cumplan el schema.
appConfigSchema.parse(defaultAppConfig);
