import type { EstadoLoteProceso } from "@/types/database.types";

/**
 * Estados que todavía pueden avanzar o cancelarse — lo opuesto a "ya
 * terminó". Separado de queries.ts (que es "server-only") porque
 * tabla.tsx lo necesita en el cliente para decidir si muestra "Cancelar".
 */
export const ESTADOS_EN_CURSO: EstadoLoteProceso[] = ["PENDIENTE", "PROCESANDO"];
