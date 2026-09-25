"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { SesionEscaneoListado } from "@/lib/escaneo/queries";

export function TablaSesionesEscaneo({
  filas,
  total,
  pagina,
  tamanoPagina,
}: {
  filas: SesionEscaneoListado[];
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
    router.push(`/validacion-odt/escaneo?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Período</th>
              <th className="px-4 py-3 font-medium">Placa</th>
              <th className="px-4 py-3 font-medium">Iniciada</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Lecturas</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No hay sesiones de escaneo con estos filtros.
                </td>
              </tr>
            ) : (
              filas.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">{s.periodo?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">{s.placa ?? "Todas"}</td>
                  <td className="px-4 py-3">{new Date(s.iniciada_en).toLocaleString("es-EC")}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.finalizada_en
                          ? "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          : "rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium"
                      }
                    >
                      {s.finalizada_en ? "Finalizada" : "En curso"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{s.cantidadEscaneos}</td>
                  <td className="px-4 py-3">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/validacion-odt/escaneo/${s.id}`}>Ver detalle</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {pagina} de {totalPaginas} · {total} sesiones
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
