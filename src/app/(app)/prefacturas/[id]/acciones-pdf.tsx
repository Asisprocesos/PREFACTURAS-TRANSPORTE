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
    try {
      const respuesta = await fetch(`/api/prefacturas/${prefacturaId}/pdf`, { method: "POST" });
      const cuerpo = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setError(cuerpo?.error ?? `No se pudo generar el PDF (HTTP ${respuesta.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo generar el PDF: se perdió la conexión con el servidor o tardó demasiado.");
    } finally {
      setCargando(false);
    }
  }

  async function descargar() {
    setError(null);
    try {
      const respuesta = await fetch(`/api/prefacturas/${prefacturaId}/pdf`);
      const cuerpo = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setError(cuerpo?.error ?? `No se pudo obtener el PDF (HTTP ${respuesta.status}).`);
        return;
      }
      window.open(cuerpo.url, "_blank");
    } catch {
      setError("No se pudo obtener el PDF: se perdió la conexión con el servidor.");
    }
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
