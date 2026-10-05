"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cancelarLoteAction, crearLoteAction, obtenerLoteEnCursoAction } from "@/lib/ejecuciones/actions";
import type { LoteProceso } from "@/lib/ejecuciones/queries";
import { listarPrefacturasParaGenerarPdfAction } from "@/lib/prefacturas/actions";

import { ejecutarLotePdf, type ProgresoPdf } from "./pdf-lote";

/**
 * Genera el PDF de todas las prefacturas del período que todavía lo
 * necesitan: BORRADOR (nunca se generó) o REQUIERE_REGENERAR (una
 * corrección de ODT dejó desactualizado el PDF vigente). Las que ya tienen
 * un PDF vigente y sin cambios (PDF_GENERADO, EN_COLA_ENVIO, ENVIADA,
 * ERROR_ENVIO) se dejan intactas — así se puede repetir sin miedo a
 * generar duplicados ni regenerar de más.
 *
 * El progreso se guarda en un lote_proceso (ver src/lib/ejecuciones): si se
 * cambia de pantalla a mitad de camino, al volver acá se detecta el lote
 * sin terminar y se ofrece continuar (recalculando qué sigue pendiente,
 * nunca se pierde lo ya generado) o cancelar.
 */
export function GenerarTodosPdfButton({
  periodoId,
  periodoNombre,
}: {
  periodoId: string | undefined;
  periodoNombre?: string;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [loteEnCurso, setLoteEnCurso] = useState<LoteProceso | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<ProgresoPdf | null>(null);
  const canceladoRef = useRef(false);

  useEffect(() => {
    canceladoRef.current = false;
    setProgreso(null);
    setMensaje(null);
    if (!periodoId) {
      setLoteEnCurso(null);
      setVerificando(false);
      return;
    }
    setVerificando(true);
    obtenerLoteEnCursoAction("PDF", periodoId).then((lote) => {
      setLoteEnCurso(lote);
      setVerificando(false);
    });
  }, [periodoId]);

  async function correrDesde(loteId: string, hechosPrevios: number) {
    setCargando(true);
    setMensaje(null);
    canceladoRef.current = false;

    const pendientes = await listarPrefacturasParaGenerarPdfAction(periodoId!);
    if (pendientes.length === 0) {
      setCargando(false);
      setLoteEnCurso(null);
      setMensaje("No hay PDF pendientes de generar en este período.");
      router.refresh();
      return;
    }

    await ejecutarLotePdf({
      loteId,
      pendientes,
      hechosPrevios,
      canceladoRef,
      onProgreso: setProgreso,
    });
    setCargando(false);
    setLoteEnCurso(null);
    router.refresh();
  }

  async function generarTodos() {
    if (!periodoId) return;
    setMensaje(null);

    const pendientes = await listarPrefacturasParaGenerarPdfAction(periodoId);
    if (pendientes.length === 0) {
      setMensaje("No hay PDF pendientes de generar en este período.");
      return;
    }

    const resultado = await crearLoteAction({
      tipo: "PDF",
      total: pendientes.length,
      periodoId,
      detalle: `PDF masivo (todos)${periodoNombre ? ` · ${periodoNombre}` : ""}`,
    });
    if (!resultado.ok || !resultado.loteId) {
      setMensaje(resultado.error ?? "No se pudo iniciar la ejecución.");
      return;
    }
    await correrDesde(resultado.loteId, 0);
  }

  async function continuar() {
    if (!loteEnCurso) return;
    await correrDesde(loteEnCurso.id, loteEnCurso.exitosos + loteEnCurso.fallidos);
  }

  async function cancelar() {
    if (!loteEnCurso) return;
    canceladoRef.current = true;
    const resultado = await cancelarLoteAction(loteEnCurso.id);
    setCargando(false);
    if (!resultado.ok) {
      setMensaje(resultado.error ?? "No se pudo cancelar.");
      return;
    }
    setLoteEnCurso(null);
    router.refresh();
  }

  if (verificando) {
    return (
      <Button variant="outline" disabled>
        Generar todos los PDF del período
      </Button>
    );
  }

  if (loteEnCurso && !cargando) {
    const procesados = loteEnCurso.exitosos + loteEnCurso.fallidos;
    return (
      <div className="flex flex-col items-end gap-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <p className="text-xs text-foreground">
          Quedó una generación de PDF a medias en este período ({procesados}/{loteEnCurso.total}).
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={continuar}>
            Continuar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={cancelar}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={generarTodos} disabled={!periodoId || cargando}>
          {cargando ? "Generando PDFs..." : "Generar todos los PDF del período"}
        </Button>
        {cargando ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={cancelar}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
      {mensaje ? <p className="text-xs text-muted-foreground">{mensaje}</p> : null}
      {progreso ? (
        <div className="text-right text-xs text-muted-foreground">
          <p>
            {progreso.hechos} / {progreso.total} procesadas · {progreso.exitosos} generados
            {progreso.errores.length > 0 ? ` · ${progreso.errores.length} con error` : ""}
          </p>
          {!cargando && progreso.errores.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-left text-destructive">
              {progreso.errores.map((e, i) => (
                <li key={i}>
                  {e.numero}: {e.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
