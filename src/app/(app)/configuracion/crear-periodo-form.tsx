"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearPeriodoAction } from "@/lib/periodos/actions";
import { construirNombrePeriodo } from "@/lib/periodos/nombre";

export function CrearPeriodoForm({
  siguienteNumero,
  sugerencia,
}: {
  siguienteNumero: number;
  sugerencia: { fechaInicio: string; fechaFin: string } | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(sugerencia?.fechaInicio ?? "");
  const [fechaFin, setFechaFin] = useState(sugerencia?.fechaFin ?? "");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  const nombrePrevio =
    fechaInicio && fechaFin && fechaFin > fechaInicio
      ? construirNombrePeriodo(siguienteNumero, fechaInicio, fechaFin)
      : null;

  async function crear() {
    if (!fechaInicio || !fechaFin) return;
    setCargando(true);
    setMensaje(null);
    const resultado = await crearPeriodoAction({ fechaInicio, fechaFin });
    setCargando(false);
    if (!resultado.ok) {
      setMensaje({ texto: resultado.error ?? "No se pudo crear el período.", ok: false });
      return;
    }
    setMensaje({ texto: "Período creado.", ok: true });
    setAbierto(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => setAbierto(true)}>
          Crear período
        </Button>
        {mensaje ? (
          <span className={mensaje.ok ? "text-sm text-primary-ink" : "text-sm text-destructive"}>
            {mensaje.texto}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-3 rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Se sugiere el rango a partir del último período registrado — ajústalo si el corte real no cae
        exactamente un mes después.
      </p>
      <div className="flex gap-3">
        <div className="space-y-2">
          <Label htmlFor="fechaInicio">Fecha inicio</Label>
          <Input
            id="fechaInicio"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaFin">Fecha fin</Label>
          <Input id="fechaFin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
      </div>
      {nombrePrevio ? (
        <p className="text-sm text-muted-foreground">
          Nombre: <span className="font-medium text-foreground">{nombrePrevio}</span>
        </p>
      ) : null}
      {mensaje && !mensaje.ok ? <p className="text-sm text-destructive">{mensaje.texto}</p> : null}
      <div className="flex gap-2">
        <Button onClick={crear} disabled={cargando || !nombrePrevio}>
          {cargando ? "Creando..." : "Crear"}
        </Button>
        <Button variant="ghost" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
