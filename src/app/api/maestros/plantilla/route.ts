import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth/roles";

export const runtime = "nodejs";

const VEHICULOS_HEADERS = [
  "Placa",
  "RUC Transportista",
  "Razón Social Transportista",
  "Nombre Transportista",
  "Tipo de Transportista",
  "Correo Transportista",
  "Correos Adicionales Transportista",
  "Activo Transportista",
  "Nombre del Conductor",
  "Propietario",
  "RUC del Propietario",
  "Regional",
  "Tipo de Vehículo",
  "Marca",
  "Modelo",
  "Año",
  "Tonelaje",
  "Correo Vehículo",
  "Correos Adicionales Vehículo",
  "Activo Vehículo",
];

const VEHICULOS_EJEMPLO = [
  "ABC1234",
  "1790012345001",
  "Transportes Ejemplo S.A.",
  "Transportes Ejemplo",
  "Contratista",
  "contacto@transportesejemplo.com",
  "facturacion@transportesejemplo.com, otro@transportesejemplo.com",
  "SI",
  "Juan Pérez",
  "",
  "",
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

/** Plantilla unificada de carga masiva de Vehículos (transportista + vehículo + conductor en una sola fila). */
export async function GET() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const libro = XLSX.utils.book_new();

  const hojaVehiculos = XLSX.utils.aoa_to_sheet([VEHICULOS_HEADERS, VEHICULOS_EJEMPLO]);
  XLSX.utils.book_append_sheet(libro, hojaVehiculos, "Vehiculos");

  const notas = XLSX.utils.aoa_to_sheet([
    ["Instrucciones"],
    ["1. No cambies el nombre de la hoja (Vehiculos) ni de las columnas."],
    ["2. Borra la fila de ejemplo antes de subir el archivo (o reemplázala por tus datos)."],
    ["3. Una fila = un vehículo. Placa es la clave del vehículo; RUC Transportista es la del transportista."],
    [
      "4. Si el mismo RUC Transportista se repite en varias filas (un transportista con varios " +
        "vehículos), solo hace falta llenar Razón Social/Nombre/Tipo/Correo del transportista en la " +
        "primera fila donde aparece ese RUC — en las siguientes puedes dejarlos vacíos, se reutiliza " +
        "el transportista ya creado.",
    ],
    [
      "5. Si el RUC Transportista ya existe en el sistema, solo se actualizan los campos que vengan " +
        "llenos en la fila (dejar una celda vacía no borra el dato que ya tenía).",
    ],
    [
      "6. Si el RUC Transportista no existe todavía, hacen falta Razón Social Transportista y Nombre " +
        "Transportista en esa fila para crearlo; si faltan, el vehículo se crea igual pero sin " +
        "transportista asociado (queda como advertencia en el resultado).",
    ],
    [
      "7. Nombre del Conductor (opcional): quién maneja el vehículo, puede ser distinto del " +
        "transportista (que es el dueño/contratista, no necesariamente el chofer). El PDF de la " +
        "prefactura usa este nombre; si se deja vacío, usa el nombre del transportista.",
    ],
    ["8. Correos Adicionales (Transportista/Vehículo): varios correos separados por coma."],
    ["9. Activo Transportista / Activo Vehículo: escribe SI o NO. Si lo dejas vacío se asume SI."],
    ["10. Regional: escribe exactamente el nombre ya registrado (ej. Quito, Guayaquil)."],
  ]);
  XLSX.utils.book_append_sheet(libro, notas, "Instrucciones");

  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Blob([new Uint8Array(buffer)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-vehiculos.xlsx"',
    },
  });
}
