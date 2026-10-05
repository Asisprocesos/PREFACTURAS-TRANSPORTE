import type { ResumenValidacion } from "@/lib/importador/validar-action";

export type PasoImportador = 1 | 2 | 3 | 4 | 5;

export interface PeriodoOpcion {
  id: string;
  numero: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
}

export interface EstadoImportador {
  paso: PasoImportador;
  archivo: File | null;
  importacionId: string | null;
  resumen: ResumenValidacion | null;
}

export const ESTADO_INICIAL: EstadoImportador = {
  paso: 1,
  archivo: null,
  importacionId: null,
  resumen: null,
};
