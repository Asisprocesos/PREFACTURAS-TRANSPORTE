"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { obtenerEstadoLoteAction, reintentarFallidosLoteAction } from "@/lib/correo/actions";
import type { EnvioCorreo, LoteProceso } from "@/lib/correo/queries";
import { cancelarLoteAction } from "@/lib/ejecuciones/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ENVIANDO: "Enviando",
  ENVIADO: "Enviado",
  ERROR: "Error",
  REINTENTAR: "Reintentando",
  CANCELADO: "Cancelado",
};

const ESTADOS_TERMINALES = new Set(["COMPLETADO", "COMPLETADO_CON_ERRORES"]);

const INTERVALO_SONDEO_MS = 4000;

export function ProgresoLote({
  lote: loteInicial,
  enviosIniciales,
  puedeReintentar,
}: {
  lote: LoteProceso;
  enviosIniciales: EnvioCorreo[];
  puedeReintentar: boolean;
}) {
  const [lote, setLote] = useState(loteInicial);
  const [envios, setEnvios] = useState(enviosIniciales);
  const [reintentando, setReintentando] = useState(false);
  const [mensajeReintento, setMensajeReintento] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [mensajeCancelar, setMensajeCancelar] = useState<string | null>(null);
  const terminado = ESTADOS_TERMINALES.has(lote.estado) || lote.estado === "CANCELADO";
  const loteIdRef = useRef(lote.id);

  // Realtime es la vía rápida (actualiza apenas cambia una fila), pero no es
  // 100% confiable — depende del websocket del navegador y de que la
  // publicación esté bien configurada. El sondeo de abajo es el respaldo
  // que garantiza que esta pantalla nunca se quede pegada aunque Realtime no
  // entregue ningún evento (fue justo lo que pasó: se enviaron los
  // correos pero la pantalla se quedó en "0 procesados").
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`lote-${lote.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lote_proceso", filter: `id=eq.${lote.id}` },
        (payload) => setLote(payload.new as LoteProceso),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "envio_correo", filter: `lote_id=eq.${lote.id}` },
        (payload) => {
          const actualizado = payload.new as EnvioCorreo;
          setEnvios((prev) => prev.map((e) => (e.id === actualizado.id ? actualizado : e)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [lote.id]);

  useEffect(() => {
    if (terminado) return;
    const intervalo = setInterval(async () => {
      const estado = await obtenerEstadoLoteAction(loteIdRef.current).catch(() => null);
      if (estado) {
        setLote(estado.lote);
        setEnvios(estado.envios);
      }
    }, INTERVALO_SONDEO_MS);
    return () => clearInterval(intervalo);
  }, [terminado]);

  async function reintentar() {
    setReintentando(true);
    setMensajeReintento(null);
    const resultado = await reintentarFallidosLoteAction(lote.id);
    setReintentando(false);
    if (!resultado.ok) {
      setMensajeReintento(resultado.error ?? "No se pudo reintentar los envíos fallidos.");
      return;
    }
    setMensajeReintento(
      `${resultado.reintentadas ?? 0} envío(s) vuelto(s) a Pendiente. El worker los retoma en su próximo ` +
        "ciclo (hasta 1 minuto) — esta pantalla se actualiza sola cuando eso pase.",
    );
  }

  async function cancelar() {
    if (
      !confirm(
        "¿Cancelar este envío? Los correos ya enviados quedan como están; los pendientes no se enviarán.",
      )
    ) {
      return;
    }
    setCancelando(true);
    setMensajeCancelar(null);
    const resultado = await cancelarLoteAction(lote.id);
    setCancelando(false);
    if (!resultado.ok) {
      setMensajeCancelar(resultado.error ?? "No se pudo cancelar.");
      return;
    }
    const estado = await obtenerEstadoLoteAction(lote.id).catch(() => null);
    if (estado) {
      setLote(estado.lote);
      setEnvios(estado.envios);
    }
  }

  const procesados = lote.exitosos + lote.fallidos;
  const porcentaje = lote.total > 0 ? Math.round((procesados / lote.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span>
            {procesados} / {lote.total} procesados · {lote.exitosos} enviados / {lote.fallidos} con error
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              terminado ? "bg-primary/20 text-primary-ink" : "bg-muted text-muted-foreground",
            )}
          >
            {lote.estado}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {terminado
            ? lote.estado === "CANCELADO"
              ? "Envío cancelado. Los correos ya enviados antes de cancelar quedan registrados tal cual."
              : "Envío terminado. Recargar esta página es seguro: solo consulta lo ya guardado, no vuelve a enviar nada."
            : `Se actualiza sola cada ${INTERVALO_SONDEO_MS / 1000}s. Recargar la página también es seguro: no reenvía nada, esta pantalla solo consulta el estado guardado en la cola.`}
        </p>
        {!terminado && puedeReintentar ? (
          <div className="mt-3 space-y-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={cancelar}
              disabled={cancelando}
            >
              {cancelando ? "Cancelando..." : "Cancelar envío"}
            </Button>
            {mensajeCancelar ? <p className="text-sm text-destructive">{mensajeCancelar}</p> : null}
          </div>
        ) : null}
      </div>

      {lote.fallidos > 0 ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            {puedeReintentar ? (
              <Button variant="outline" onClick={reintentar} disabled={reintentando}>
                {reintentando ? "Reintentando..." : "Reintentar fallidos"}
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <a href={`/api/lotes/${lote.id}/exportar`}>Descargar reporte de errores</a>
            </Button>
          </div>
          {mensajeReintento ? <p className="text-sm text-muted-foreground">{mensajeReintento}</p> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Destinatario</th>
              <th className="px-3 py-2 font-medium">Asunto</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {envios.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2">{(e.destinatarios_to as unknown as string[]).join(", ")}</td>
                <td className="px-3 py-2">
                  {e.asunto}
                  {e.zip_storage_key ? (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      ZIP · {e.prefactura_ids?.length ?? 0} prefacturas
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{ETIQUETA_ESTADO[e.estado] ?? e.estado}</td>
                <td className="px-3 py-2 text-xs text-destructive">{e.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
