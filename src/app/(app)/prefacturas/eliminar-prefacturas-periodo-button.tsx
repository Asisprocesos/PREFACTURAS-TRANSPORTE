"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contarPrefacturasPeriodoAction, eliminarPrefacturasPeriodoAction } from "@/lib/prefacturas/actions";

const PALABRA_CONFIRMACION = "ELIMINAR";

/**
 * Pensado para limpiar datos de prueba antes de entregar el sistema (ver
 * eliminarPrefacturasPeriodoAction) — borrado físico, no anulación, así que
 * pide escribir una palabra de confirmación además de mostrar cuántas
 * prefacturas se van a borrar, en vez de un simple confirm() del navegador.
 */
export function EliminarPrefacturasPeriodoButton({
  periodoId,
  periodoNombre,
}: {
  periodoId: string | undefined;
  periodoNombre: string | undefined;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cargandoConteo, setCargandoConteo] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrir() {
    if (!periodoId) return;
    setAbierto(true);
    setError(null);
    setConfirmacion("");
    setTotal(null);
    setCargandoConteo(true);
    try {
      const conteo = await contarPrefacturasPeriodoAction(periodoId);
      setTotal(conteo);
    } finally {
      setCargandoConteo(false);
    }
  }

  async function confirmarEliminacion() {
    if (!periodoId) return;
    setEliminando(true);
    setError(null);
    const resultado = await eliminarPrefacturasPeriodoAction(periodoId);
    setEliminando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudieron eliminar las prefacturas.");
      return;
    }
    setAbierto(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <Button type="button" variant="destructive" onClick={abrir} disabled={!periodoId}>
        Eliminar prefacturas del período
      </Button>
    );
  }

  return (
    <div className="w-full max-w-md space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">
        Eliminar permanentemente las prefacturas de {periodoNombre ?? "este período"}
      </p>
      <p className="text-sm text-muted-foreground">
        {cargandoConteo
          ? "Calculando cuántas prefacturas hay en este período..."
          : `Se eliminarán ${total ?? 0} prefacturas: su detalle congelado, sus PDF generados (incluido el archivo en el almacenamiento) y su historial de envíos. Esta acción no se puede deshacer.`}
      </p>
      <p className="text-xs text-muted-foreground">
        Las ODT importadas y el período en sí no se eliminan — después puedes volver a &quot;Generar
        prefacturas del período&quot; si hace falta.
      </p>
      <div className="space-y-1">
        <Label htmlFor="confirmacionEliminarPrefacturas" className="text-xs">
          Escribe <span className="font-mono font-semibold">{PALABRA_CONFIRMACION}</span> para confirmar
        </Label>
        <Input
          id="confirmacionEliminarPrefacturas"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          autoComplete="off"
          disabled={eliminando}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={confirmacion !== PALABRA_CONFIRMACION || eliminando || cargandoConteo || total === 0}
          onClick={confirmarEliminacion}
        >
          {eliminando ? "Eliminando..." : `Eliminar ${total ?? ""} prefacturas`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAbierto(false)} disabled={eliminando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
