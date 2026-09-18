const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export function construirVariablesPlantilla(prefactura: {
  numero: string | null;
  total: number;
  periodo: { nombre: string } | null;
  vehiculo: { placa: string } | null;
  transportista: { razon_social: string } | null;
}) {
  return {
    PLACA: prefactura.vehiculo?.placa ?? "",
    RAZON_SOCIAL: prefactura.transportista?.razon_social ?? "",
    PERIODO: prefactura.periodo?.nombre ?? "",
    NUMERO: prefactura.numero ?? "",
    TOTAL: formatoMoneda.format(prefactura.total),
  };
}
