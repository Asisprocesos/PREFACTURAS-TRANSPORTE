import { nombreTransportista } from "@/lib/transportistas/display";

import type { NovedadFueraDePeriodo, PlacaSinVehiculo, PrefacturaReporte, PuntoMonto } from "./queries";

const ETIQUETA_ESTADO: Record<string, string> = {
  BORRADOR: "Borrador",
  CON_NOVEDADES: "Con novedades",
  LISTA: "Lista",
  PDF_GENERADO: "PDF generado",
  EN_COLA_ENVIO: "En cola de envío",
  ENVIADA: "Enviada",
  ERROR_ENVIO: "Error de envío",
  REQUIERE_REGENERAR: "Requiere regenerar",
  ANULADA: "Anulada",
};

export type FilaExcel = Record<string, string | number>;

export function filasPrefacturas(prefacturas: PrefacturaReporte[]): FilaExcel[] {
  return prefacturas.map((p) => ({
    Número: p.numero ?? "(sin número)",
    Período: p.periodo?.nombre ?? "",
    Placa: p.vehiculo?.placa ?? "",
    Transportista: nombreTransportista(p.transportista) ?? "",
    RUC: p.transportista?.ruc ?? "",
    "Cantidad ODT": p.cantidad_odt,
    "Total ODT": p.total_odt,
    Descuentos: p.total_descuentos,
    Total: p.total,
    Estado: ETIQUETA_ESTADO[p.estado] ?? p.estado,
  }));
}

export function filasErroresEnvio(
  prefacturas: PrefacturaReporte[],
  errores: Map<string, string>,
): FilaExcel[] {
  return prefacturas
    .filter((p) => p.estado === "ERROR_ENVIO")
    .map((p) => ({
      Número: p.numero ?? "(sin número)",
      Placa: p.vehiculo?.placa ?? "",
      Transportista: nombreTransportista(p.transportista) ?? "",
      Total: p.total,
      "Último error": errores.get(p.id) ?? "",
    }));
}

export function filasResumenCentroCosto(datos: PuntoMonto[]): FilaExcel[] {
  return datos.map((d) => ({
    "Centro de costo": d.nombre,
    "Cantidad ODT": d.cantidad,
    Monto: d.monto,
  }));
}

export function filasPlacasSinVehiculo(placas: PlacaSinVehiculo[]): FilaExcel[] {
  return placas.map((p) => ({
    Placa: p.placa,
    "Cantidad ODT": p.cantidadOdt,
    "Última fecha": p.ultimaFecha,
    "Valor total": p.valorTotal,
  }));
}

export function filasRezagos(novedades: NovedadFueraDePeriodo[]): FilaExcel[] {
  return novedades.map((n) => ({
    PROVEEDOR: n.transportista ?? "",
    Placa: n.placa ?? "",
    "PERIODO DE FAC": n.periodo ?? "",
    Valor: n.valor ?? 0,
    FACTURADO: n.facturado ? "Sí" : "No",
    Diferencias: n.resolucion ?? (n.estado === "ABIERTA" ? "Pendiente de resolución" : ""),
  }));
}
