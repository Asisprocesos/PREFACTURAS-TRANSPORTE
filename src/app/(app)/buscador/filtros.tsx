"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FiltrosBuscador({
  periodos,
  transportistas,
}: {
  periodos: { id: string; nombre: string }[];
  transportistas: { id: string; razon_social: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [texto, setTexto] = useState(searchParams.get("texto") ?? "");
  const [placa, setPlaca] = useState(searchParams.get("placa") ?? "");
  const [estado, setEstado] = useState(searchParams.get("estado") ?? "");
  const [fechaDesde, setFechaDesde] = useState(searchParams.get("desde") ?? "");
  const [fechaHasta, setFechaHasta] = useState(searchParams.get("hasta") ?? "");

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (texto.trim()) params.set("texto", texto.trim());
    if (placa.trim()) params.set("placa", placa.trim());
    if (estado.trim()) params.set("estado", estado.trim());
    if (fechaDesde) params.set("desde", fechaDesde);
    if (fechaHasta) params.set("hasta", fechaHasta);
    const periodoActual = searchParams.get("periodo");
    if (periodoActual) params.set("periodo", periodoActual);
    const transportistaActual = searchParams.get("transportista");
    if (transportistaActual) params.set("transportista", transportistaActual);
    router.push(`/buscador?${params.toString()}`);
  }

  function actualizarSelect(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    router.push(`/buscador?${params.toString()}`);
  }

  return (
    <form onSubmit={buscar} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="texto">Guía / número</Label>
          <Input id="texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar guía..." />
        </div>
        <div className="space-y-1">
          <Label htmlFor="placa">Placa</Label>
          <Input id="placa" value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC1234" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="estadoFenix">Estado (Fénix)</Label>
          <Input id="estadoFenix" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="Entregado" />
        </div>
        <div className="space-y-1">
          <Label>Período</Label>
          <select
            value={searchParams.get("periodo") ?? ""}
            onChange={(e) => actualizarSelect("periodo", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos los períodos</option>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Transportista</Label>
          <select
            value={searchParams.get("transportista") ?? ""}
            onChange={(e) => actualizarSelect("transportista", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos los transportistas</option>
            {transportistas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.razon_social}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="desde">Desde</Label>
            <Input id="desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hasta">Hasta</Label>
            <Input id="hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit">Buscar</Button>
      </div>
    </form>
  );
}
