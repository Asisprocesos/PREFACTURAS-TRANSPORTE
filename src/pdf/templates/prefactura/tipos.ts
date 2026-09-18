export interface DatosPdfPrefactura {
  numero: string;
  periodoNombre: string;
  fechaEmision: string;
  placa: string;
  razonSocial: string;
  ruc: string;
  conductor: string | null;
  totalOdt: number;
  totalDescuentos: number;
  total: number;
  detalleOdt: {
    item: number;
    fecha: string;
    ruta: string;
    regional: string;
    centroCosto: string;
    guia: string;
    valor: number;
  }[];
  resumenCentroCosto: {
    centroCosto: string;
    regional: string;
    ruta: string;
    cantidad: number;
    suma: number;
  }[];
  empresa: {
    nombre: string;
    nombreDocumento: string;
    contacto: {
      quito: string;
      guayaquil: string;
      telefono: string;
      sitioWeb: string;
    };
  };
  leyenda: string;
}
