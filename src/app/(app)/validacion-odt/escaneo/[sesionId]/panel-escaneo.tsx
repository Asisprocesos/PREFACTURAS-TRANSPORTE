"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { finalizarSesionEscaneoAction, registrarEscaneoAction } from "@/lib/escaneo/actions";
import type { EscaneoOdt, FilaMatch, ResumenValorEscaneo, SesionEscaneo } from "@/lib/escaneo/queries";
import { cn } from "@/lib/utils";

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const ETIQUETA_RESULTADO: Record<FilaMatch["resultado"], { texto: string; icono: string; clase: string }> = {
  ESCANEADA_Y_CARGADA: { texto: "Escaneada y cargada", icono: "✅", clase: "text-primary" },
  ESCANEADA_NO_CARGADA: { texto: "Escaneada pero no cargada", icono: "⚠️", clase: "text-amber-600" },
  CARGADA_SIN_FISICA: { texto: "Cargada pero sin ODT física", icono: "❌", clase: "text-destructive" },
  OTRA_PLACA_O_PERIODO: {
    texto: "Escaneada pero es de otra placa/período",
    icono: "🔀",
    clase: "text-purple-600",
  },
};

function beep(frecuencia: number) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frecuencia;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    // Sin audio disponible (ej. navegador sin soporte): el feedback visual sigue funcionando.
  }
}

export function PanelEscaneo({
  sesion,
  escaneosIniciales,
  matchInicial,
  resumenValorInicial,
}: {
  sesion: SesionEscaneo;
  escaneosIniciales: EscaneoOdt[];
  matchInicial: FilaMatch[];
  resumenValorInicial: ResumenValorEscaneo;
}) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [ultimoMensaje, setUltimoMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  const [pegado, setPegado] = useState("");
  const [procesandoLista, setProcesandoLista] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function procesarGuia(guia: string) {
    const resultado = await registrarEscaneoAction(sesion.id, guia);
    beep(resultado.ok ? 880 : 220);
    setUltimoMensaje({
      texto: resultado.ok ? `Registrada: ${resultado.guia}` : (resultado.error ?? "Error"),
      ok: resultado.ok,
    });
    return resultado;
  }

  async function onSubmitLectura(e: React.FormEvent) {
    e.preventDefault();
    if (!valor.trim()) return;
    await procesarGuia(valor);
    setValor("");
    inputRef.current?.focus();
    router.refresh();
  }

  async function procesarLista() {
    setProcesandoLista(true);
    const guias = pegado
      .split(/[\n,;]+/)
      .map((g) => g.trim())
      .filter(Boolean);
    for (const g of guias) {
      await procesarGuia(g);
    }
    setProcesandoLista(false);
    setPegado("");
    router.refresh();
  }

  async function finalizar() {
    await finalizarSesionEscaneoAction(sesion.id);
    router.refresh();
  }

  const resumen = matchInicial.reduce(
    (acc, m) => {
      acc[m.resultado] = (acc[m.resultado] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Lector USB</h2>
          <form onSubmit={onSubmitLectura} className="flex gap-2">
            <input
              ref={inputRef}
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={!!sesion.finalizada_en}
              placeholder="Escanea o escribe la guía y presiona Enter"
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
          </form>
          {ultimoMensaje ? (
            <p className={cn("mt-2 text-sm", ultimoMensaje.ok ? "text-primary" : "text-destructive")}>
              {ultimoMensaje.texto}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Escaneadas en esta sesión: {escaneosIniciales.length}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Pegar lista</h2>
          <textarea
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            disabled={!!sesion.finalizada_en}
            rows={4}
            placeholder="Una guía por línea (o separadas por coma)"
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
          />
          <Button
            variant="outline"
            className="mt-2"
            onClick={procesarLista}
            disabled={procesandoLista || !pegado.trim() || !!sesion.finalizada_en}
          >
            {procesandoLista ? "Procesando..." : "Procesar lista"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Valor esperado (ODT cargadas)</p>
          <p className="text-lg font-semibold">{formatoMoneda.format(resumenValorInicial.totalEsperado)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Confirmado con ODT física</p>
          <p className="text-lg font-semibold text-primary">
            {formatoMoneda.format(resumenValorInicial.totalConfirmado)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Falta por escanear</p>
          <p
            className={cn(
              "text-lg font-semibold",
              resumenValorInicial.totalFaltante > 0 ? "text-destructive" : "text-primary",
            )}
          >
            {formatoMoneda.format(resumenValorInicial.totalFaltante)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        {Object.entries(ETIQUETA_RESULTADO).map(([clave, etiqueta]) => (
          <span key={clave} className={cn("rounded-full bg-muted px-3 py-1", etiqueta.clase)}>
            {etiqueta.icono} {etiqueta.texto}: {resumen[clave] ?? 0}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Guía</th>
              <th className="px-3 py-2 font-medium">Resultado</th>
              <th className="px-3 py-2 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {matchInicial.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  Todavía no hay lecturas ni ODT esperadas.
                </td>
              </tr>
            ) : (
              matchInicial.map((m, i) => (
                <tr key={`${m.guia}-${i}`}>
                  <td className="px-3 py-2">{m.guia}</td>
                  <td className={cn("px-3 py-2", ETIQUETA_RESULTADO[m.resultado].clase)}>
                    {ETIQUETA_RESULTADO[m.resultado].icono} {ETIQUETA_RESULTADO[m.resultado].texto}
                  </td>
                  <td className="px-3 py-2">{m.valor != null ? formatoMoneda.format(m.valor) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Button asChild variant="outline">
          <a href={`/api/escaneo/${sesion.id}/exportar`}>Descargar Excel</a>
        </Button>
        {!sesion.finalizada_en ? (
          <Button variant="secondary" onClick={finalizar}>
            Finalizar sesión
          </Button>
        ) : null}
      </div>
    </div>
  );
}
