"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { listarFilasImportacionAction } from "@/lib/importador/lectura-actions";
import type { ImportacionFila, PestanaFilas } from "@/lib/importador/queries";
import type { ResumenValidacion } from "@/lib/importador/validar-action";
import { cn } from "@/lib/utils";

const TAMANO_PAGINA = 25;

const PESTANAS: { id: PestanaFilas; etiqueta: (r: ResumenValidacion) => string }[] = [
  { id: "errores", etiqueta: (r) => `Errores (${r.filasConError})` },
  { id: "advertencias", etiqueta: (r) => `Advertencias (${r.filasAdvertencias})` },
  { id: "validas", etiqueta: (r) => `Válidas (${r.filasValidas})` },
];

export function ResultadosValidacion({
  importacionId,
  resumen,
}: {
  importacionId: string;
  resumen: ResumenValidacion;
}) {
  const [pestana, setPestana] = useState<PestanaFilas>("errores");
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState<ImportacionFila[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    listarFilasImportacionAction({ importacionId, pestana, pagina, tamanoPagina: TAMANO_PAGINA })
      .then((r) => {
        if (cancelado) return;
        setFilas(r.filas);
        setTotal(r.total);
      })
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [importacionId, pestana, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Resumen etiqueta="Leídas" valor={resumen.filasLeidas} />
        <Resumen etiqueta="Válidas" valor={resumen.filasValidas} tono="ok" />
        <Resumen etiqueta="Con error" valor={resumen.filasConError} tono="error" />
        <Resumen etiqueta="Con advertencia" valor={resumen.filasAdvertencias} tono="advertencia" />
        <Resumen etiqueta="Excluidas (no Entregado)" valor={resumen.filasExcluidas} />
      </div>

      <div className="flex gap-2 border-b">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPestana(p.id);
              setPagina(1);
            }}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              pestana === p.id ? "border-primary text-primary" : "border-transparent text-muted-foreground",
            )}
          >
            {p.etiqueta(resumen)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Fila</th>
              <th className="px-3 py-2 font-medium">Guía</th>
              <th className="px-3 py-2 font-medium">Placa</th>
              <th className="px-3 py-2 font-medium">Mensajes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cargando ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Sin filas en esta pestaña.
                </td>
              </tr>
            ) : (
              filas.map((f) => {
                const norm = f.datos_normalizados as Record<string, unknown> | null;
                const mensajes = [...(f.errores as string[]), ...(f.advertencias as string[])];
                return (
                  <tr key={f.id}>
                    <td className="px-3 py-2">{f.numero_fila}</td>
                    <td className="px-3 py-2">{(norm?.guia as string) ?? "—"}</td>
                    <td className="px-3 py-2">{(norm?.placaNormalizada as string) ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{mensajes.join(" · ") || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

function Resumen({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: number;
  tono?: "ok" | "error" | "advertencia";
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p
        className={cn(
          "text-2xl font-bold",
          tono === "ok" && "text-primary",
          tono === "error" && "text-destructive",
          tono === "advertencia" && "text-amber-600",
        )}
      >
        {valor}
      </p>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
    </div>
  );
}
