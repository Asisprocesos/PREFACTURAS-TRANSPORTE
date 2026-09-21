import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { defaultAppConfig } from "@/config/app.config";
import {
  obtenerDetalleOdt,
  obtenerPrefactura,
  obtenerResumenFacturacion,
  type Odt,
  type PrefacturaConRelaciones,
} from "@/lib/prefacturas/queries";

import { DocumentoPrefactura } from "./templates/prefactura/documento";
import type { DatosPdfPrefactura } from "./templates/prefactura/tipos";

export interface PrefacturaLista {
  ok: true;
  prefactura: PrefacturaConRelaciones;
}
export interface PrefacturaNoLista {
  ok: false;
  motivo: string;
}

/**
 * Valida que la prefactura pueda generar PDF: RUC, razón social y al menos
 * una ODT (regla explícita del generador). La ausencia de novedades ERROR
 * se revisa aparte, en el Route Handler, porque requiere una consulta a
 * `novedad` que no vale la pena duplicar aquí.
 */
export async function validarPrefacturaParaPdf(
  prefacturaId: string,
): Promise<PrefacturaLista | PrefacturaNoLista> {
  const prefactura = await obtenerPrefactura(prefacturaId);
  if (!prefactura) return { ok: false, motivo: "Prefactura no encontrada." };
  if (!prefactura.transportista?.ruc) return { ok: false, motivo: "El transportista no tiene RUC." };
  if (!prefactura.transportista?.razon_social) {
    return { ok: false, motivo: "El transportista no tiene razón social." };
  }
  if (prefactura.cantidad_odt <= 0) return { ok: false, motivo: "La prefactura no tiene ODT." };
  return { ok: true, prefactura };
}

export function nombreArchivoPdf(placa: string, ruc: string): string {
  return defaultAppConfig.pdf.nombreArchivo.replace("{PLACA}", placa).replace("{RUC}", ruc);
}

export interface ResultadoBufferPdf {
  buffer: Buffer;
  detalleOdt: Odt[];
}

/**
 * Devuelve también `detalleOdt` (ya consultado internamente) para que
 * `generarYGuardarPdf` no tenga que repetir la misma consulta después, solo
 * para armar el log de ejecución — cada round-trip a Supabase de más pesa
 * en el tiempo total contra el límite de la función serverless.
 */
export async function generarBufferPdf(prefactura: PrefacturaConRelaciones): Promise<ResultadoBufferPdf> {
  const [detalleOdt, resumen] = await Promise.all([
    obtenerDetalleOdt(prefactura.id),
    obtenerResumenFacturacion(prefactura.id),
  ]);

  const datos: DatosPdfPrefactura = {
    numero: prefactura.numero ?? "(sin número)",
    periodoNombre: prefactura.periodo?.nombre ?? "",
    fechaEmision: new Date().toLocaleDateString("es-EC"),
    placa: prefactura.vehiculo?.placa ?? "",
    razonSocial: prefactura.transportista?.razon_social ?? "",
    ruc: prefactura.transportista?.ruc ?? "",
    conductor: null,
    totalOdt: prefactura.total_odt,
    totalDescuentos: prefactura.total_descuentos,
    total: prefactura.total,
    detalleOdt: detalleOdt.map((o, i) => ({
      item: i + 1,
      fecha: o.fecha_creacion,
      ruta: o.ruta ?? o.ruta_macro ?? "—",
      regional: o.regional_origen_texto ?? "—",
      centroCosto: o.centro_costo_final ?? "—",
      guia: o.guia,
      valor: o.valor_final ?? o.valor,
    })),
    resumenCentroCosto: resumen.map((r) => ({
      centroCosto: r.centro_costo_final ?? "—",
      regional: r.regional ?? "—",
      ruta: r.ruta_macro ?? "—",
      cantidad: r.cantidad ?? 0,
      suma: r.suma ?? 0,
    })),
    empresa: {
      nombre: defaultAppConfig.empresa.nombre,
      nombreDocumento: defaultAppConfig.empresa.nombreDocumento,
      contacto: defaultAppConfig.empresa.contacto,
    },
    leyenda: defaultAppConfig.pdf.leyenda,
  };

  const buffer = await renderToBuffer(DocumentoPrefactura({ datos }));
  return { buffer, detalleOdt };
}
