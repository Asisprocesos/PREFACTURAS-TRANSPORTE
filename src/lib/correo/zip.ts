import JSZip from "jszip";

export interface ArchivoParaZip {
  nombreArchivo: string;
  contenido: Buffer;
}

/**
 * Arma un único ZIP en memoria con los PDF indicados, para el envío
 * consolidado a prefacturas sin correo registrado (ver encolarEnviosAction).
 * Si dos archivos comparten nombre (ej. dos vehículos con el mismo número de
 * prefactura entre períodos), se numeran para no pisarse dentro del ZIP.
 */
export async function crearZipPrefacturas(archivos: ArchivoParaZip[]): Promise<Buffer> {
  const zip = new JSZip();
  const nombresUsados = new Map<string, number>();

  for (const archivo of archivos) {
    const veces = nombresUsados.get(archivo.nombreArchivo) ?? 0;
    nombresUsados.set(archivo.nombreArchivo, veces + 1);
    const nombreFinal =
      veces === 0
        ? archivo.nombreArchivo
        : archivo.nombreArchivo.replace(/(\.[^.]+)?$/, (ext) => ` (${veces})${ext ?? ""}`);
    zip.file(nombreFinal, archivo.contenido);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
