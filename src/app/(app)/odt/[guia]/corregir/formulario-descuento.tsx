"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  actualizarDescuentoAction,
  anularDescuentoAction,
  crearDescuentoAction,
} from "@/lib/descuentos/actions";
import type { Descuento } from "@/lib/descuentos/queries";

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export function FormularioDescuento({ odtId, descuentos }: { odtId: string; descuentos: Descuento[] }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setExito(false);
    const montoNumero = Number(monto);
    const resultado = editando
      ? await actualizarDescuentoAction(editando, motivo, montoNumero)
      : await crearDescuentoAction(odtId, motivo, montoNumero);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo guardar el descuento.");
      return;
    }
    setExito(true);
    setMotivo("");
    setMonto("");
    setEditando(null);
    router.refresh();
  }

  function editar(d: Descuento) {
    setEditando(d.id);
    setMotivo(d.concepto ?? "");
    setMonto(String(d.valor));
    setExito(false);
    setError(null);
  }

  function cancelarEdicion() {
    setEditando(null);
    setMotivo("");
    setMonto("");
    setError(null);
  }

  async function anular(id: string) {
    if (!confirm("¿Anular este descuento? Dejará de afectar el total de la prefactura.")) return;
    setCargando(true);
    setError(null);
    const resultado = await anularDescuentoAction(id);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo anular el descuento.");
      return;
    }
    if (editando === id) cancelarEdicion();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {descuentos.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {descuentos.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
              <div>
                <span className="font-medium text-destructive">-{formatoMoneda.format(d.valor)}</span>
                <span className="ml-2 text-muted-foreground">{d.concepto}</span>
                <p className="text-xs text-muted-foreground">
                  {new Date(d.created_at).toLocaleString("es-EC")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => editar(d)}
                  disabled={cargando}
                >
                  Corregir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => anular(d.id)}
                  disabled={cargando}
                >
                  Anular
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Esta guía no tiene descuentos aplicados.</p>
      )}

      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm font-medium">{editando ? "Corregir descuento" : "Aplicar nuevo descuento"}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="motivoDescuento">Motivo (ej. paquetería dañada)</Label>
            <Input id="motivoDescuento" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="montoDescuento">Monto a descontar</Label>
            <Input
              id="montoDescuento"
              type="number"
              step="0.01"
              min="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {exito ? (
          <p className="text-sm text-primary-ink">
            Descuento guardado. Si la prefactura ya tenía un PDF generado, quedó marcada para regenerar.
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={cargando}>
            {cargando ? "Guardando..." : editando ? "Guardar corrección" : "Aplicar descuento"}
          </Button>
          {editando ? (
            <Button type="button" variant="outline" onClick={cancelarEdicion} disabled={cargando}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
