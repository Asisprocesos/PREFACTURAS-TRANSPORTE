import type { CampoOdt } from "@/lib/importador/campos";
import type { ResumenValidacion } from "@/lib/importador/validar-action";

export type PasoImportador = 1 | 2 | 3 | 4 | 5;

export interface EstadoImportador {
  paso: PasoImportador;
  archivo: File | null;
  importacionId: string | null;
  hojas: { nombre: string; filas: number }[];
  hojaElegida: string | null;
  encabezados: string[];
  filasPreview: unknown[][];
  mapeo: Record<string, CampoOdt | null>;
  periodoId: string;
  resumen: ResumenValidacion | null;
}

export const ESTADO_INICIAL: EstadoImportador = {
  paso: 1,
  archivo: null,
  importacionId: null,
  hojas: [],
  hojaElegida: null,
  encabezados: [],
  filasPreview: [],
  mapeo: {},
  periodoId: "",
  resumen: null,
};
