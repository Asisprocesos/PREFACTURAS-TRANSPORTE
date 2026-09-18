import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth/roles";
import { obtenerMatchSesion } from "@/lib/escaneo/queries";

export const runtime = "nodejs";

const ETIQUETA: Record<string, string> = {
  ESCANEADA_Y_CARGADA: "Escaneada y cargada",
  ESCANEADA_NO_CARGADA: "Escaneada pero no cargada",
  CARGADA_SIN_FISICA: "Cargada pero sin ODT física",
  OTRA_PLACA_O_PERIODO: "Escaneada pero es de otra placa/período",
};

export async function GET(_request: Request, { params }: { params: Promise<{ sesionId: string }> }) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { sesionId } = await params;

  const filas = await obtenerMatchSesion(sesionId);

  const hoja = XLSX.utils.json_to_sheet(
    filas.map((f) => ({ Guía: f.guia, Resultado: ETIQUETA[f.resultado] ?? f.resultado })),
  );
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Escaneo");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Blob([new Uint8Array(buffer)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="escaneo-${sesionId}.xlsx"`,
    },
  });
}
