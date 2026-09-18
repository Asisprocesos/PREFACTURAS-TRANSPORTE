"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AccionesPdf({ prefacturaId, tieneVigente }: { prefacturaId: string; tieneVigente: boolean }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setCargando(true);
    setError(null);
    const respuesta = await fetch(`/api/prefacturas/${prefacturaId}/pdf`, { method: "POST" });
    const cuerpo = await respuesta.json();
    setCargando(false);
    if (!respuesta.ok) {
      setError(cuerpo.error ?? "No se pudo generar el PDF.");
      return;
    }
    router.refresh();
  }

  async function descargar() {
    const respuesta = await fetch(`/api/prefacturas/${prefacturaId}/pdf`);
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      setError(cuerpo.error ?? "No se pudo obtener el PDF.");
      return;
    }
    window.open(cuerpo.url, "_blank");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" onClick={generar} disabled={cargando}>
          {cargando ? "Generando..." : tieneVigente ? "Regenerar PDF" : "Generar PDF"}
        </Button>
        {tieneVigente ? (
          <Button size="sm" variant="outline" onClick={descargar}>
            Ver / descargar PDF
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
