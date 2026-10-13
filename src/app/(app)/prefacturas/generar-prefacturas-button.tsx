"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { generarPrefacturasPeriodoAction } from "@/lib/prefacturas/actions";

export function GenerarPrefacturasButton({ periodoId }: { periodoId: string | undefined }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function generar() {
    if (!periodoId) return;
    setCargando(true);
    setMensaje(null);
    const resultado = await generarPrefacturasPeriodoAction(periodoId);
    setCargando(false);
    if (!resultado.ok) {
      setMensaje(resultado.error ?? "No se pudo generar las prefacturas.");
      return;
    }
    const partes = [`${resultado.creadas} prefacturas nuevas`, `${resultado.actualizadas} actualizadas`];
    if (resultado.requierenRegenerar) {
      partes.push(
        `${resultado.requierenRegenerar} cambiaron de transportista y quedaron marcadas "Requiere regenerar"`,
      );
    }
    setMensaje(`${partes.join(", ")}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={generar} disabled={!periodoId || cargando}>
        {cargando ? "Generando..." : "Generar prefacturas del período"}
      </Button>
      {mensaje ? <p className="text-xs text-muted-foreground">{mensaje}</p> : null}
    </div>
  );
}
