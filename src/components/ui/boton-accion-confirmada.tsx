"use client";

import { useState } from "react";

import { Button, type ButtonProps } from "./button";

/**
 * Botón para una acción irreversible-desde-la-UI (eliminar/restaurar un
 * registro): pide DOS confirmaciones seguidas antes de ejecutar, para que
 * un clic accidental no baste. `onExito` decide qué pasa después
 * (refrescar la lista, redirigir, etc.) — cada pantalla lo resuelve distinto.
 */
export function BotonAccionConfirmada({
  accion,
  etiqueta,
  etiquetaCargando,
  confirmacion1,
  confirmacion2,
  variant = "outline",
  size = "sm",
  className,
  onExito,
}: {
  accion: () => Promise<{ ok: boolean; error?: string }>;
  etiqueta: string;
  etiquetaCargando?: string;
  confirmacion1: string;
  confirmacion2: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  onExito: () => void;
}) {
  const [cargando, setCargando] = useState(false);

  async function ejecutar() {
    if (!confirm(confirmacion1)) return;
    if (!confirm(confirmacion2)) return;
    setCargando(true);
    const resultado = await accion();
    setCargando(false);
    if (!resultado.ok) {
      alert(resultado.error ?? "No se pudo completar la acción.");
      return;
    }
    onExito();
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={ejecutar}
      disabled={cargando}
    >
      {cargando ? (etiquetaCargando ?? "Procesando...") : etiqueta}
    </Button>
  );
}
