"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { LogEjecucion } from "@/lib/log-ejecucion/queries";

const ETIQUETA_ETAPA: Record<string, string> = {
  IMPORTACION: "Importación",
  VALIDACION: "Validación",
  PDF: "PDF",
  CORREO: "Correo",
};

const ESTILO_ESTADO: Record<string, string> = {
  OK: "bg-primary/20 text-foreground",
  ADVERTENCIA: "bg-yellow-100 text-yellow-800",
  ERROR: "bg-destructive/10 text-destructive",
};

const formatoFecha = new Intl.DateTimeFormat("es-EC", { dateStyle: "short", timeStyle: "short" });

export function TablaHistorial({
  filas,
  total,
  pagina,
  tamanoPagina,
}: {
  filas: LogEjecucion[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));

  function irAPagina(nuevaPagina: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nuevaPagina));
    router.push(`/historial?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Guía</th>
              <th className="px-4 py-3 font-medium">Etapa</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Sin registros con estos filtros.
                </td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3">{formatoFecha.format(new Date(f.fecha))}</td>
                  <td className="px-4 py-3">{f.guia ?? "—"}</td>
                  <td className="px-4 py-3">{ETIQUETA_ETAPA[f.etapa] ?? f.etapa}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_ESTADO[f.estado] ?? ""}`}
                    >
                      {f.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {f.detalle ? JSON.stringify(f.detalle) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {pagina} de {totalPaginas} · {total} registros
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
