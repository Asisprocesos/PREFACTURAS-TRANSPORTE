import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth/roles";
import {
  filasErroresEnvio,
  filasPlacasSinVehiculo,
  filasPrefacturas,
  filasResumenCentroCosto,
  filasRezagos,
  type FilaExcel,
} from "@/lib/reportes/generar";
import {
  obtenerNovedadesFueraDePeriodo,
  obtenerPlacasSinVehiculo,
  obtenerPrefacturasReporte,
  obtenerResumenCentroCostoCompleto,
  obtenerUltimosErroresEnvio,
} from "@/lib/reportes/queries";

export const runtime = "nodejs";

const TIPOS_VALIDOS = [
  "prefacturas",
  "enviadas",
  "pendientes",
  "generadas-sin-enviar",
  "errores-envio",
  "centro-costo",
  "rezagos",
  "placas-sin-vehiculo",
] as const;

// Estados con un documento_pdf VIGENTE pero sin llegar todavía a ENVIADA —
// a diferencia de "pendientes" (que incluye BORRADOR/CON_NOVEDADES/LISTA,
// que ni siquiera tienen PDF generado), esta lista es justo la que sirve
// para descargar y reenviar manualmente: alternativa al ZIP de respaldo
// cuando no se quiere depender de ese envío automático (ver encolarConsolidadoSinCorreo).
const ESTADOS_GENERADOS_SIN_ENVIAR = ["PDF_GENERADO", "EN_COLA_ENVIO", "ERROR_ENVIO", "REQUIERE_REGENERAR"];
type TipoReporte = (typeof TIPOS_VALIDOS)[number];

function construirLibro(hojas: { nombre: string; filas: FilaExcel[] }[]): Buffer {
  const libro = XLSX.utils.book_new();
  for (const hoja of hojas) {
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(hoja.filas), hoja.nombre.slice(0, 31));
  }
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function GET(request: Request) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);

  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") as TipoReporte | null;
  const periodoId = url.searchParams.get("periodo");
  const transportistaId = url.searchParams.get("transportista") ?? undefined;

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return Response.json({ error: "Tipo de reporte inválido." }, { status: 400 });
  }
  if (!periodoId) {
    return Response.json({ error: "Debe indicar un período." }, { status: 400 });
  }

  let buffer: Buffer;

  if (tipo === "centro-costo") {
    const datos = await obtenerResumenCentroCostoCompleto(periodoId);
    buffer = construirLibro([{ nombre: "Centro de costo", filas: filasResumenCentroCosto(datos) }]);
  } else if (tipo === "rezagos") {
    const novedades = await obtenerNovedadesFueraDePeriodo(periodoId);
    buffer = construirLibro([{ nombre: "Rezagos", filas: filasRezagos(novedades) }]);
  } else if (tipo === "placas-sin-vehiculo") {
    const placas = await obtenerPlacasSinVehiculo(periodoId);
    buffer = construirLibro([{ nombre: "Placas sin vehículo", filas: filasPlacasSinVehiculo(placas) }]);
  } else {
    const prefacturas = await obtenerPrefacturasReporte(periodoId, transportistaId);
    if (tipo === "prefacturas") {
      buffer = construirLibro([{ nombre: "Prefacturas", filas: filasPrefacturas(prefacturas) }]);
    } else if (tipo === "enviadas") {
      buffer = construirLibro([
        { nombre: "Enviadas", filas: filasPrefacturas(prefacturas.filter((p) => p.estado === "ENVIADA")) },
      ]);
    } else if (tipo === "pendientes") {
      const pendientes = prefacturas.filter((p) =>
        ["BORRADOR", "CON_NOVEDADES", "LISTA", "PDF_GENERADO", "EN_COLA_ENVIO"].includes(p.estado),
      );
      buffer = construirLibro([{ nombre: "Pendientes de envío", filas: filasPrefacturas(pendientes) }]);
    } else if (tipo === "generadas-sin-enviar") {
      const generadas = prefacturas.filter((p) => ESTADOS_GENERADOS_SIN_ENVIAR.includes(p.estado));
      buffer = construirLibro([{ nombre: "Generadas sin enviar", filas: filasPrefacturas(generadas) }]);
    } else {
      const errores = await obtenerUltimosErroresEnvio(prefacturas.map((p) => p.id));
      buffer = construirLibro([
        { nombre: "Errores de envío", filas: filasErroresEnvio(prefacturas, errores) },
      ]);
    }
  }

  return new Response(new Blob([new Uint8Array(buffer)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-${tipo}-${periodoId}.xlsx"`,
    },
  });
}
