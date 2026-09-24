"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { confirmarImportacionAction, revertirImportacionAction } from "@/lib/importador/confirmar-action";
import { corregirFilaImportacionAction } from "@/lib/importador/correccion-action";
import type { Importacion } from "@/lib/importador/queries";
import type { ResumenValidacion } from "@/lib/importador/validar-action";

import { ResultadosValidacion } from "../resultados-validacion";

export function DetalleImportacion({ importacion, esAdmin }: { importacion: Importacion; esAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [dispararRecarga, setDispararRecarga] = useState(0);
  const [resumen, setResumen] = useState<ResumenValidacion>({
    filasLeidas: importacion.filas_leidas,
    filasValidas: importacion.filas_validas,
    filasConError: importacion.filas_con_error,
    filasAdvertencias: importacion.filas_advertencias,
    filasExcluidas: 0,
    // Aproxima con las filas sin error hasta que se corrija/revalide alguna
    // (`importacion` no persiste filasParaInsertar; a partir de ahí el
    // valor real viene de onResumenActualizado).
    filasParaInsertar: importacion.filas_validas + importacion.filas_advertencias,
  });
  const revalidando = useRef(false);

  // Al volver de "Corregir" en otro módulo (crear vehículo, agregar correo,
  // ajustar el catálogo), el enlace trae `?revalidarFila=<id>`: revalida esa
  // fila contra los catálogos ya actualizados (sin cambiar ningún dato de la
  // fila) para que la advertencia/error desaparezca sin que el usuario
  // tenga que volver a tocarla.
  useEffect(() => {
    const filaId = searchParams.get("revalidarFila");
    if (!filaId || revalidando.current) return;
    revalidando.current = true;
    corregirFilaImportacionAction(filaId, {}).then((r) => {
      if (r.ok && r.resumen) setResumen(r.resumen);
      setMensaje(
        r.ok
          ? (r.errores?.length ?? 0) > 0
            ? "Fila revalidada: todavía tiene errores pendientes."
            : "Fila revalidada: ya quedó lista."
          : (r.error ?? "No se pudo revalidar la fila."),
      );
      setDispararRecarga((n) => n + 1);
      router.replace(`/importar/${importacion.id}`, { scroll: false });
      revalidando.current = false;
    });
  }, [searchParams, importacion.id, router]);

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
          onResumenActualizado={setResumen}
          soloLectura={importacion.estado !== "VALIDADA"}
          puedeAdministrarCatalogo={esAdmin}
          dispararRecarga={dispararRecarga}
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
