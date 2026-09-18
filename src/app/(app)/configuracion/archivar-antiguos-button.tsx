"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { archivarPeriodosAntiguosAction } from "@/lib/periodos/actions";

export function ArchivarAntiguosButton({ periodosCalientes }: { periodosCalientes: number }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function ejecutar() {
    setCargando(true);
    setMensaje(null);
    const resultado = await archivarPeriodosAntiguosAction();
    setCargando(false);
    setMensaje(
      resultado.ok
        ? `${resultado.archivados ?? 0} período(s) archivado(s).`
        : (resultado.error ?? "No se pudo archivar."),
    );
    if (resultado.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
      <div className="flex-1">
        <p className="text-sm font-medium">Archivar períodos antiguos</p>
        <p className="text-sm text-muted-foreground">
          Archiva todos los períodos cerrados más allá de los {periodosCalientes} más recientes
          (&ldquo;períodos calientes&rdquo;). No borra datos: solo genera el respaldo y marca el período como
          archivado.
        </p>
      </div>
      <Button variant="outline" onClick={ejecutar} disabled={cargando}>
        {cargando ? "Archivando..." : "Archivar ahora"}
      </Button>
      {mensaje ? <p className="w-full text-sm text-muted-foreground">{mensaje}</p> : null}
    </div>
  );
}
