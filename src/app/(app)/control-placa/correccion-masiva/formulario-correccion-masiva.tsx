"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { corregirOdtMasivoAction } from "@/lib/odt/actions";

export function FormularioCorreccionMasiva({ periodos }: { periodos: { id: string; nombre: string }[] }) {
  const [periodoId, setPeriodoId] = useState("");
  const [tipoRutaActual, setTipoRutaActual] = useState("REEMPLAZO TRANSPORTE");
  const [nuevoTipoRuta, setNuevoTipoRuta] = useState("");
  const [nuevoCentroCosto, setNuevoCentroCosto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    const resultado = await corregirOdtMasivoAction({
      periodoId,
      tipoRutaActual,
      nuevoTipoRuta,
      nuevoCentroCosto,
      motivo,
    });
    setCargando(false);
    setMensaje({
      texto: resultado.ok
        ? `Se corrigieron ${resultado.afectadas} ODT.`
        : (resultado.error ?? "No se pudo aplicar la corrección."),
      ok: resultado.ok,
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="periodoId">Período</Label>
        <select
          id="periodoId"
          value={periodoId}
          onChange={(e) => setPeriodoId(e.target.value)}
          required
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Elige un período</option>
          {periodos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tipoRutaActual">Tipo de Ruta actual</Label>
        <Input
          id="tipoRutaActual"
          value={tipoRutaActual}
          onChange={(e) => setTipoRutaActual(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nuevoTipoRuta">Nuevo Tipo de Ruta</Label>
          <Input
            id="nuevoTipoRuta"
            value={nuevoTipoRuta}
            onChange={(e) => setNuevoTipoRuta(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nuevoCentroCosto">Nuevo Centro de Costo</Label>
          <Input
            id="nuevoCentroCosto"
            value={nuevoCentroCosto}
            onChange={(e) => setNuevoCentroCosto(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="motivo">Motivo (obligatorio)</Label>
        <textarea
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          required
          rows={2}
          className="w-full rounded-md border border-input bg-background p-2 text-sm"
        />
      </div>
      {mensaje ? (
        <p className={mensaje.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{mensaje.texto}</p>
      ) : null}
      <Button type="submit" disabled={cargando}>
        {cargando ? "Aplicando..." : "Aplicar corrección masiva"}
      </Button>
    </form>
  );
}
