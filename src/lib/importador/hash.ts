/**
 * SHA-256 de un archivo usando Web Crypto (navegador). Se usa para detectar
 * si el mismo archivo ya se importó antes, sin tener que subirlo primero.
 */
export async function calcularHashArchivo(archivo: File): Promise<string> {
  const buffer = await archivo.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
