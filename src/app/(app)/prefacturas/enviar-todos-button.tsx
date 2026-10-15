"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { encolarTodosDelPeriodoAction } from "@/lib/correo/actions";

/**
 * "Enviar todos los del período": encola de una vez todas las prefacturas
 * con PDF vigente listas para enviar (PDF_GENERADO o ERROR_ENVIO), sin tener
 * que marcarlas fila por fila ni página por página — el checkbox "seleccionar
 * todos" de la tabla solo cubre la página visible. El envío real sigue
 * corriendo vía la cola de correo (pg_cron), igual que "Enviar seleccionados".
 */
export function EnviarTodosButton({
  periodoId,
  periodoNombre,
}: {
  periodoId: string | undefined;
  periodoNombre?: string;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function enviarTodos() {
    if (!periodoId) return;
    if (
      !confirm(
        `¿Enviar por correo todas las prefacturas listas de${periodoNombre ? ` ${periodoNombre}` : " este período"}? Se encolan para el envío automático.`,
      )
    ) {
      return;
    }
    setCargando(true);
    setMensaje(null);
    const resultado = await encolarTodosDelPeriodoAction(periodoId);
    setCargando(false);
    if (!resultado.ok) {
      setMensaje(resultado.error ?? "No se pudo encolar el envío.");
      return;
    }
    if (resultado.loteId) {
      router.push(`/prefacturas/lotes/${resultado.loteId}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={enviarTodos} disabled={!periodoId || cargando}>
        {cargando ? "Encolando..." : "Envíos de correos de todo el período"}
      </Button>
      {mensaje ? <p className="text-xs text-muted-foreground">{mensaje}</p> : null}
    </div>
  );
}
