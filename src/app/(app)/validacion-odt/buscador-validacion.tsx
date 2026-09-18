"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buscarPrefacturaAction, type EstadoBusqueda } from "@/lib/validacion-odt/actions";

const estadoInicial: EstadoBusqueda = {};

export function BuscadorValidacion({ periodos }: { periodos: { id: string; nombre: string }[] }) {
  const [estado, formAction, enviando] = useActionState(buscarPrefacturaAction, estadoInicial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="periodoId">Período</Label>
        <select
          id="periodoId"
          name="periodoId"
          required
          className="h-10 w-56 rounded-md border border-input bg-background px-3 text-sm"
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
        <Label htmlFor="placa">Placa</Label>
        <Input id="placa" name="placa" placeholder="ABC1234" required className="w-40" />
      </div>
      <Button type="submit" disabled={enviando}>
        {enviando ? "Buscando..." : "Buscar"}
      </Button>
      {estado.error ? <p className="w-full text-sm text-destructive">{estado.error}</p> : null}
    </form>
  );
}
