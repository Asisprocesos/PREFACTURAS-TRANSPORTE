"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { reintentarFallidosLoteAction } from "@/lib/correo/actions";
import type { EnvioCorreo, LoteProceso } from "@/lib/correo/queries";
import { createClient } from "@/lib/supabase/client";

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ENVIANDO: "Enviando",
  ENVIADO: "Enviado",
  ERROR: "Error",
  REINTENTAR: "Reintentando",
};

export function ProgresoLote({
  lote: loteInicial,
  enviosIniciales,
}: {
  lote: LoteProceso;
  enviosIniciales: EnvioCorreo[];
}) {
  const [lote, setLote] = useState(loteInicial);
  const [envios, setEnvios] = useState(enviosIniciales);
  const [reintentando, setReintentando] = useState(false);

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

  async function reintentar() {
    setReintentando(true);
    await reintentarFallidosLoteAction(lote.id);
    setReintentando(false);
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
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{lote.estado}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${porcentaje}%` }} />
        </div>
      </div>

      {lote.fallidos > 0 ? (
        <div className="flex gap-2">
          <Button variant="outline" onClick={reintentar} disabled={reintentando}>
            {reintentando ? "Reintentando..." : "Reintentar fallidos"}
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/lotes/${lote.id}/exportar`}>Descargar reporte de errores</a>
          </Button>
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
                <td className="px-3 py-2">{e.asunto}</td>
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
