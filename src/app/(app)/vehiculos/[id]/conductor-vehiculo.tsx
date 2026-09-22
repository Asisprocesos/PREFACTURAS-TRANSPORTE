"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { asignarConductorVehiculoAction } from "@/lib/vehiculos/actions";
import type { ConductorVigente } from "@/lib/vehiculos/queries";

export function ConductorVehiculo({
  vehiculoId,
  conductorActual,
  soloLectura,
}: {
  vehiculoId: string;
  conductorActual: ConductorVigente | null;
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const resultado = await asignarConductorVehiculoAction(vehiculoId, nombre);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo registrar el conductor.");
      return;
    }
    setNombre("");
    setEditando(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Este es el conductor que aparece en el PDF de la prefactura. Sin uno registrado, el PDF intenta
        adivinarlo con el campo &quot;Chofer&quot; de las ODT importadas, que no siempre es confiable.
      </p>

      {conductorActual ? (
        <p className="text-sm">
          <span className="font-medium">{conductorActual.nombre}</span>{" "}
          <span className="text-xs text-muted-foreground">
            desde {new Date(conductorActual.vigenteDesde).toLocaleDateString("es-EC")}
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Sin conductor registrado.</p>
      )}

      {!soloLectura ? (
        editando ? (
          <form onSubmit={guardar} className="flex flex-wrap items-end gap-2">
            <Input
              placeholder="Nombre completo del conductor"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="max-w-xs"
            />
            <Button type="submit" size="sm" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
            {conductorActual ? "Cambiar conductor" : "Registrar conductor"}
          </Button>
        )
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
