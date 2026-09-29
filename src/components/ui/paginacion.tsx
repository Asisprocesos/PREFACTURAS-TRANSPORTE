"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { construirPaginasVisibles } from "@/lib/paginacion";
import { cn } from "@/lib/utils";

import { Button } from "./button";

/** Paginador numerado (1 2 3 ... N) con flechas Anterior/Siguiente a los costados. */
export function Paginacion({
  pagina,
  totalPaginas,
  onCambiarPagina,
}: {
  pagina: number;
  totalPaginas: number;
  onCambiarPagina: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;
  const paginas = construirPaginasVisibles(pagina, totalPaginas);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pagina <= 1}
        onClick={() => onCambiarPagina(pagina - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {paginas.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant="outline"
            size="sm"
            className={cn(
              "w-9 px-0",
              p === pagina && "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            disabled={p === pagina}
            onClick={() => onCambiarPagina(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={pagina >= totalPaginas}
        onClick={() => onCambiarPagina(pagina + 1)}
        aria-label="Página siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
