"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { encolarEnviosAction } from "@/lib/correo/actions";
import { obtenerUrlDocumentoAction } from "@/lib/repositorio/actions";
import type { DocumentoConRelaciones } from "@/lib/repositorio/queries";

export function TablaDocumentos({
  filas,
  total,
  pagina,
  tamanoPagina,
}: {
  filas: DocumentoConRelaciones[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));

  async function abrir(documentoId: string, accion: "VISUALIZACION" | "DESCARGA") {
    const resultado = await obtenerUrlDocumentoAction(documentoId, accion);
    if (resultado.ok && resultado.url) {
      window.open(resultado.url, "_blank");
    }
  }

  async function reenviar(prefacturaId: string) {
    const resultado = await encolarEnviosAction([prefacturaId]);
    if (resultado.ok && resultado.loteId) {
      router.push(`/prefacturas/lotes/${resultado.loteId}`);
    }
  }

  function irAPagina(nuevaPagina: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nuevaPagina));
    router.push(`/repositorio?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Número</th>
              <th className="px-4 py-3 font-medium">Placa</th>
              <th className="px-4 py-3 font-medium">Transportista</th>
              <th className="px-4 py-3 font-medium">Período</th>
              <th className="px-4 py-3 font-medium">Versión</th>
              <th className="px-4 py-3 font-medium">Generado</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  No hay documentos con estos filtros.
                </td>
              </tr>
            ) : (
              filas.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium">{d.prefactura?.numero ?? "—"}</td>
                  <td className="px-4 py-3">{d.prefactura?.vehiculo?.placa ?? "—"}</td>
                  <td className="px-4 py-3">{d.prefactura?.transportista?.razon_social ?? "—"}</td>
                  <td className="px-4 py-3">{d.prefactura?.periodo?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">v{d.version}</td>
                  <td className="px-4 py-3">{new Date(d.generado_en).toLocaleDateString("es-EC")}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        d.estado === "VIGENTE"
                          ? "rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {d.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" onClick={() => abrir(d.id, "VISUALIZACION")}>
                        Ver
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => abrir(d.id, "DESCARGA")}>
                        Descargar
                      </Button>
                      {d.prefactura ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/repositorio/${d.prefactura.id}/versiones`}>Versiones</Link>
                        </Button>
                      ) : null}
                      {d.estado === "VIGENTE" && d.prefactura ? (
                        <Button variant="ghost" size="sm" onClick={() => reenviar(d.prefactura!.id)}>
                          Reenviar
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {pagina} de {totalPaginas} · {total} documentos
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => irAPagina(pagina - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => irAPagina(pagina + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
