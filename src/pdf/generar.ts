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
import { completarRuc, nombreTransportista } from "@/lib/transportistas/display";
import { obtenerConductorVigente } from "@/lib/vehiculos/queries";

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
 * Valida que la prefactura pueda generar PDF: placa, un nombre (del
 * transportista si ya está asignado, o si no el de respaldo tomado del
 * campo Chofer de las ODT — ver nombre_pendiente) y al menos una ODT. Ya NO
 * exige RUC ni razón social del transportista: una prefactura "mínima"
 * (placa sin vehículo/transportista registrado todavía, ver
 * generar_prefacturas_periodo) genera igual su PDF con esos campos en
 * blanco, para poder trabajar con ella desde ya — se completa sola la
 * próxima vez que se generen las prefacturas del período, una vez
 * registrado el vehículo/transportista. La ausencia de novedades ERROR se
 * revisa aparte, en el Route Handler, porque requiere una consulta a
 * `novedad` que no vale la pena duplicar aquí.
 */
export async function validarPrefacturaParaPdf(
  prefacturaId: string,
): Promise<PrefacturaLista | PrefacturaNoLista> {
  const prefactura = await obtenerPrefactura(prefacturaId);
  if (!prefactura) return { ok: false, motivo: "Prefactura no encontrada." };
  if (!prefactura.placa_normalizada) return { ok: false, motivo: "La prefactura no tiene placa." };
  if (!nombreTransportista(prefactura.transportista) && !prefactura.nombre_pendiente) {
    return {
      ok: false,
      motivo: "Falta un nombre para el PDF (ni transportista asignado ni chofer en las ODT).",
    };
  }
  if (prefactura.cantidad_odt <= 0) return { ok: false, motivo: "La prefactura no tiene ODT." };
  return { ok: true, prefactura };
}

/**
 * El nombre siempre sigue la estructura configurada (por defecto
 * "PF-{PLACA}-{RUC}.pdf"); si falta la placa o el RUC se usa un marcador
 * legible en su lugar en vez de dejar el nombre incompleto (ej.
 * "PF-SIN PLACA-1790012345001.pdf").
 */
export function nombreArchivoPdf(placa: string, ruc: string): string {
  const placaSegura = placa.trim() || "SIN PLACA";
  const rucSeguro = ruc.trim() || "SIN RUC";
  return defaultAppConfig.pdf.nombreArchivo.replace("{PLACA}", placaSegura).replace("{RUC}", rucSeguro);
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
  const [detalleOdt, resumen, conductorRegistrado] = await Promise.all([
    obtenerDetalleOdt(prefactura.id),
    obtenerResumenFacturacion(prefactura.id),
    prefactura.vehiculo?.id ? obtenerConductorVigente(prefactura.vehiculo.id) : Promise.resolve(null),
  ]);

  const datos: DatosPdfPrefactura = {
    numero: prefactura.numero ?? "(sin número)",
    periodoNombre: prefactura.periodo?.nombre ?? "",
    fechaEmision: new Date().toLocaleDateString("es-EC"),
    placa: prefactura.vehiculo?.placa ?? prefactura.placa_normalizada,
    // Sin transportista asignado (prefactura "mínima"), se muestra el
    // nombre de respaldo (nombre_pendiente, del campo Chofer de las ODT) en
    // vez de dejar el documento sin ningún nombre — RUC sí queda en blanco,
    // no hay de dónde sacarlo.
    razonSocial: prefactura.transportista?.razon_social ?? prefactura.nombre_pendiente ?? "",
    ruc: completarRuc(prefactura.transportista?.ruc),
    // El vehículo puede tener un conductor distinto del transportista (el
    // transportista es dueño/contratista, no necesariamente quien maneja).
    // Cuando no hay un conductor registrado para el vehículo, el PDF cae al
    // nombre del transportista y, si tampoco hay transportista todavía, al
    // nombre de respaldo (Chofer de las ODT, el mismo que nombre_pendiente).
    conductor:
      conductorRegistrado?.nombre ??
      nombreTransportista(prefactura.transportista) ??
      prefactura.nombre_pendiente,
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
      descuento: o.descuentoTotal,
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
    ajuste: !prefactura.es_principal ? { motivo: prefactura.motivo } : null,
  };

  const buffer = await renderToBuffer(DocumentoPrefactura({ datos }));
  return { buffer, detalleOdt };
}
