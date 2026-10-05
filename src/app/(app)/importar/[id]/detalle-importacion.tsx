"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { confirmarLoteImportacionAction, revertirImportacionAction } from "@/lib/importador/confirmar-action";
import { corregirFilaImportacionAction } from "@/lib/importador/correccion-action";
import type { BorradorMapeo } from "@/lib/importador/lectura-actions";
import type { Importacion } from "@/lib/importador/queries";
import { crearUrlDescargaImportacionAction } from "@/lib/importador/storage";
import type { ResumenValidacion } from "@/lib/importador/validar-action";

import { PasoMapeo } from "../paso-mapeo";
import { ResultadosValidacion } from "../resultados-validacion";
import { Stepper } from "../stepper";
import type { PeriodoOpcion } from "../tipos";

export function DetalleImportacion({
  importacion,
  periodos,
  esAdmin,
  puedeGestionar,
}: {
  importacion: Importacion;
  periodos: PeriodoOpcion[];
  esAdmin: boolean;
  puedeGestionar: boolean;
}) {
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
    let totalOdt = 0;
    try {
      for (;;) {
        let r = await confirmarLoteImportacionAction(importacion.id).catch(() => null);
        if (!r || !r.ok) {
          // Un solo reintento antes de rendirnos con esta vuelta — un lote
          // ya confirmado no se vuelve a insertar, así que es seguro seguir
          // dándole "Confirmar importación" hasta terminar.
          r = await confirmarLoteImportacionAction(importacion.id).catch(() => null);
        }
        if (!r || !r.ok) {
          setMensaje(
            totalOdt > 0
              ? `Se insertaron ${totalOdt} ODT antes de perder la conexión. Vuelve a darle "Confirmar importación" para continuar con el resto (es seguro, no duplica lo ya insertado).`
              : (r?.error ?? "Error al confirmar."),
          );
          return;
        }
        totalOdt += r.odtInsertadas ?? 0;
        setMensaje(`Confirmando... ${totalOdt} ODT insertadas hasta ahora.`);
        if (!r.filasRestantes) break;
      }
      setMensaje(`Confirmada: ${totalOdt} ODT insertadas.`);
    } finally {
      setCargando(false);
      router.refresh();
    }
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
      ) : importacion.estado === "BORRADOR" ? (
        puedeGestionar ? (
          <ContinuarMapeo importacion={importacion} periodos={periodos} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta importación quedó sin terminar el mapeo. Pídele a un operador o administrador que la
            continúe.
          </p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta importación todavía no tiene resultados de validación.
        </p>
      )}

      {mensaje ? <p className="text-sm text-primary-ink">{mensaje}</p> : null}

      {puedeGestionar ? (
        <div className="flex gap-2">
          {importacion.estado === "VALIDADA" ? (
            <Button onClick={confirmar} disabled={cargando}>
              {cargando ? "Confirmando..." : "Confirmar importación"}
            </Button>
          ) : null}
          {importacion.estado === "CONFIRMADA" ? (
            <Button variant="destructive" onClick={revertir} disabled={cargando}>
              Revertir importación
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reanuda los pasos 2-3 del asistente de importación (elegir hoja, mapear
 * columnas, elegir período) cuando se abandonaron a medias: recupera el
 * archivo original desde Storage (nunca se perdió, solo el estado del
 * asistente que vivía en memoria del navegador) y retoma desde el borrador
 * guardado, si lo hay.
 */
function ContinuarMapeo({ importacion, periodos }: { importacion: Importacion; periodos: PeriodoOpcion[] }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<2 | 3>(2);

  async function continuar() {
    setCargando(true);
    setError(null);
    try {
      const { url, nombreArchivo } = await crearUrlDescargaImportacionAction(importacion.id);
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error("No se pudo descargar el archivo original.");
      const blob = await respuesta.blob();
      setArchivo(new File([blob], nombreArchivo));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo continuar la importación.");
    } finally {
      setCargando(false);
    }
  }

  if (!archivo) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Esta importación quedó sin terminar el mapeo (se perdió al cambiar de pantalla a medias). El archivo
          original ya está guardado — puedes continuar desde donde quedó, sin volver a subirlo.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={continuar} disabled={cargando}>
          {cargando ? "Recuperando archivo..." : "Continuar mapeo"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Stepper pasoActual={paso} />
      <PasoMapeo
        importacionId={importacion.id}
        archivo={archivo}
        periodos={periodos}
        borradorInicial={(importacion.borrador as unknown as BorradorMapeo | null) ?? undefined}
        onPaso={setPaso}
        onValidado={() => router.refresh()}
      />
    </div>
  );
}
