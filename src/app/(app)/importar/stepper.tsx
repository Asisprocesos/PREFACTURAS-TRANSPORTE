import { cn } from "@/lib/utils";

import type { PasoImportador } from "./tipos";

const PASOS: { numero: PasoImportador; etiqueta: string }[] = [
  { numero: 1, etiqueta: "Cargar" },
  { numero: 2, etiqueta: "Leer" },
  { numero: 3, etiqueta: "Mapear" },
  { numero: 4, etiqueta: "Validar" },
  { numero: 5, etiqueta: "Confirmar" },
];

export function Stepper({ pasoActual }: { pasoActual: PasoImportador }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {PASOS.map((p, i) => (
        <li key={p.numero} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
              p.numero === pasoActual
                ? "bg-primary text-primary-foreground"
                : p.numero < pasoActual
                  ? "bg-primary/30 text-primary-foreground/80"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {p.numero}
          </span>
          <span className={p.numero === pasoActual ? "font-medium" : "text-muted-foreground"}>
            {p.etiqueta}
          </span>
          {i < PASOS.length - 1 ? <span className="mx-1 text-muted-foreground">→</span> : null}
        </li>
      ))}
    </ol>
  );
}
