import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth/roles";

export const runtime = "nodejs";

const TRANSPORTISTAS_HEADERS = [
  "RUC",
  "Razón Social",
  "Nombre",
  "Tipo de Transportista",
  "Correo Principal",
  "Correos Adicionales",
  "Activo",
];

const TRANSPORTISTAS_EJEMPLO = [
  "1790012345001",
  "Transportes Ejemplo S.A.",
  "Transportes Ejemplo",
  "Contratista",
  "contacto@transportesejemplo.com",
  "facturacion@transportesejemplo.com, otro@transportesejemplo.com",
  "SI",
];

const VEHICULOS_HEADERS = [
  "Placa",
  "RUC Transportista",
  "Nombre del Conductor",
  "Regional",
  "Tipo de Vehículo",
  "Marca",
  "Modelo",
  "Año",
  "Tonelaje",
  "Correo Principal",
  "Correos Adicionales",
  "Activo",
];

const VEHICULOS_EJEMPLO = [
  "ABC1234",
  "1790012345001",
  "Juan Pérez",
  "Quito",
  "Camión",
  "Hino",
  "300",
  "2020",
  "3.5",
  "conductor@transportesejemplo.com",
  "",
  "SI",
];

/** Plantilla de carga masiva de Transportistas y Vehículos (ver /transportistas/importar). */
export async function GET() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const libro = XLSX.utils.book_new();

  const hojaTransportistas = XLSX.utils.aoa_to_sheet([TRANSPORTISTAS_HEADERS, TRANSPORTISTAS_EJEMPLO]);
  XLSX.utils.book_append_sheet(libro, hojaTransportistas, "Transportistas");

  const hojaVehiculos = XLSX.utils.aoa_to_sheet([VEHICULOS_HEADERS, VEHICULOS_EJEMPLO]);
  XLSX.utils.book_append_sheet(libro, hojaVehiculos, "Vehiculos");

  const notas = XLSX.utils.aoa_to_sheet([
    ["Instrucciones"],
    ["1. No cambies los nombres de las hojas (Transportistas, Vehiculos) ni de las columnas."],
    ["2. Borra la fila de ejemplo antes de subir el archivo (o reemplázala por tus datos)."],
    [
      "3. RUC es la clave para reconocer un transportista que ya existe: si el RUC ya está en el sistema, se actualizan sus datos; si no, se crea uno nuevo.",
    ],
    ["4. Placa es la clave para un vehículo, igual que RUC para transportista."],
    [
      '5. "RUC Transportista" en la hoja Vehiculos debe coincidir con un RUC de la hoja Transportistas (de este mismo archivo) o con uno que ya exista en el sistema.',
    ],
    ["6. Correos Adicionales: varios correos separados por coma."],
    ["7. Activo: escribe SI o NO. Si lo dejas vacío se asume SI."],
    ["8. Regional: escribe exactamente el nombre ya registrado (ej. Quito, Guayaquil)."],
    [
      "9. Nombre del Conductor (opcional): quién maneja el vehículo, puede ser distinto del " +
        "transportista (que es el dueño/contratista, no necesariamente el chofer). El PDF de la " +
        "prefactura usa este nombre; si se deja vacío, usa el nombre del transportista.",
    ],
  ]);
  XLSX.utils.book_append_sheet(libro, notas, "Instrucciones");

  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Blob([new Uint8Array(buffer)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-transportistas-vehiculos.xlsx"',
    },
  });
}
