import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { crearZipPrefacturas } from "@/lib/correo/zip";

describe("crearZipPrefacturas", () => {
  it("empaqueta cada archivo con su nombre original", async () => {
    const buffer = await crearZipPrefacturas([
      { nombreArchivo: "ABC1234.pdf", contenido: Buffer.from("uno") },
      { nombreArchivo: "DEF5678.pdf", contenido: Buffer.from("dos") },
    ]);

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files).sort()).toEqual(["ABC1234.pdf", "DEF5678.pdf"]);
    expect(await zip.files["ABC1234.pdf"]!.async("string")).toBe("uno");
    expect(await zip.files["DEF5678.pdf"]!.async("string")).toBe("dos");
  });

  it("numera archivos con el mismo nombre para no pisarse", async () => {
    const buffer = await crearZipPrefacturas([
      { nombreArchivo: "ABC1234.pdf", contenido: Buffer.from("uno") },
      { nombreArchivo: "ABC1234.pdf", contenido: Buffer.from("dos") },
    ]);

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files).sort()).toEqual(["ABC1234 (1).pdf", "ABC1234.pdf"]);
  });
});
