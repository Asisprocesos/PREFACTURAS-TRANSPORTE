"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { confirmarImportacionAction, revertirImportacionAction } from "@/lib/importador/confirmar-action";
import type { Importacion } from "@/lib/importador/queries";

import { ResultadosValidacion } from "../resultados-validacion";

export function DetalleImportacion({ importacion }: { importacion: Importacion }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const resumen = {
    filasLeidas: importacion.filas_leidas,
    filasValidas: importacion.filas_validas,
    filasConError: importacion.filas_con_error,
    filasAdvertencias: importacion.filas_advertencias,
    filasExcluidas: 0,
    // Solo se usa para las etiquetas de esta vista de solo lectura (no hay
    // botón "Continuar" aquí); aproxima con las filas sin error al validar.
    filasParaInsertar: importacion.filas_validas + importacion.filas_advertencias,
  };

  async function confirmar() {
    setCargando(true);
    setMensaje(null);
    const r = await confirmarImportacionAction(importacion.id);
    setCargando(false);
    setMensaje(r.ok ? `Confirmada: ${r.odtInsertadas} ODT insertadas.` : (r.error ?? "Error al confirmar."));
    router.refresh();
  }

  async function revertir() {
    if (!confirm("¿Revertir esta importación? Se eliminarán las ODT que generó.")) return;
    setCargando(true);
    setMensaje(null);
    const r = await revertirImportacionAction(importacion.id);
    setCargando(false);
    setMensaje(r.ok ? "Importación revertida." : (r.error ?? "Error al revertir."));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {importacion.estado === "VALIDADA" || importacion.estado === "CONFIRMADA" ? (
        <ResultadosValidacion
          importacionId={importacion.id}
          resumen={resumen}
          soloLectura={importacion.estado !== "VALIDADA"}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta importación todavía no tiene resultados de validación.
        </p>
      )}

      {mensaje ? <p className="text-sm text-primary">{mensaje}</p> : null}

      <div className="flex gap-2">
        {importacion.estado === "VALIDADA" ? (
          <Button onClick={confirmar} disabled={cargando}>
            Confirmar importación
          </Button>
        ) : null}
        {importacion.estado === "CONFIRMADA" ? (
          <Button variant="destructive" onClick={revertir} disabled={cargando}>
            Revertir importación
          </Button>
        ) : null}
      </div>
    </div>
  );
}
