import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth/roles";
import { listarEnviosLote } from "@/lib/correo/queries";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ loteId: string }> }) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { loteId } = await params;

  const envios = await listarEnviosLote(loteId);
  const hoja = XLSX.utils.json_to_sheet(
    envios.map((e) => ({
      Destinatario: (e.destinatarios_to as unknown as string[]).join(", "),
      Asunto: e.asunto,
      Estado: e.estado,
      Intentos: e.intentos,
      Error: e.error ?? "",
    })),
  );
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Envios");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Blob([new Uint8Array(buffer)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lote-${loteId}.xlsx"`,
    },
  });
}
