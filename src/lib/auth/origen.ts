import "server-only";

import { headers } from "next/headers";

/**
 * Origen (protocolo + host) de la petición actual, para construir URLs
 * absolutas en Server Actions (ej. redirectTo de una invitación) sin
 * depender de una variable de entorno fija — funciona igual en localhost,
 * previews de Vercel y producción.
 */
export async function obtenerOrigen(): Promise<string> {
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "localhost:3000";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}
