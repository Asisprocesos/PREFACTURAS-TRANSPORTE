"use client";

import { Button } from "@/components/ui/button";
import { obtenerUrlDocumentoAction } from "@/lib/repositorio/actions";
import type { DocumentoPdf } from "@/lib/repositorio/queries";

export function ListaVersiones({ versiones }: { versiones: DocumentoPdf[] }) {
  async function abrir(documentoId: string, accion: "VISUALIZACION" | "DESCARGA") {
    const resultado = await obtenerUrlDocumentoAction(documentoId, accion);
    if (resultado.ok && resultado.url) window.open(resultado.url, "_blank");
  }

  if (versiones.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no se ha generado ningún PDF.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Versión</th>
            <th className="px-4 py-3 font-medium">Generado</th>
            <th className="px-4 py-3 font-medium">Tamaño</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {versiones.map((v) => (
            <tr key={v.id}>
              <td className="px-4 py-3 font-medium">v{v.version}</td>
              <td className="px-4 py-3">{new Date(v.generado_en).toLocaleString("es-EC")}</td>
              <td className="px-4 py-3">
                {v.tamano_bytes ? `${Math.round(v.tamano_bytes / 1024)} KB` : "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    v.estado === "VIGENTE"
                      ? "rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {v.estado}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => abrir(v.id, "VISUALIZACION")}>
                    Ver
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => abrir(v.id, "DESCARGA")}>
                    Descargar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
