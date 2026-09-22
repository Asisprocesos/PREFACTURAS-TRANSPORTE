"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "./button";

/** Confirma, ejecuta un borrado lógico y redirige al listado. */
export function BotonEliminar({
  onEliminar,
  etiqueta = "Eliminar",
  confirmacion,
  redirigirA,
}: {
  onEliminar: () => Promise<{ ok: boolean; error?: string }>;
  etiqueta?: string;
  confirmacion: string;
  redirigirA: string;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  async function eliminar() {
    if (!confirm(confirmacion)) return;
    setCargando(true);
    const resultado = await onEliminar();
    setCargando(false);
    if (!resultado.ok) {
      alert(resultado.error ?? "No se pudo eliminar.");
      return;
    }
    router.push(redirigirA);
  }

  return (
    <Button variant="destructive" size="sm" onClick={eliminar} disabled={cargando}>
      {cargando ? "Eliminando..." : etiqueta}
    </Button>
  );
}
