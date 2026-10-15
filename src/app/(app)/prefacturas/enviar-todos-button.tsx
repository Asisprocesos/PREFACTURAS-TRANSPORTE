"use client";

import Link from "next/link";
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
  const [loteId, setLoteId] = useState<string | null>(null);

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
    setLoteId(null);
    const resultado = await encolarTodosDelPeriodoAction(periodoId);
    setCargando(false);
    if (!resultado.ok) {
      setMensaje(resultado.error ?? "No se pudo encolar el envío.");
      return;
    }
    // No se navega directo al lote: el resumen (sobre todo las omitidas, que
    // antes pasaban desapercibidas con este botón) se queda visible hasta que
    // el usuario elija "Ver progreso del lote" — igual que "Enviar
    // seleccionados" ya hace en prefacturas-table.tsx.
    const partes = [`${resultado.encoladas} encoladas para envío individual`];
    if (resultado.consolidadasSinCorreo) {
      partes.push(`${resultado.consolidadasSinCorreo} consolidadas en un ZIP (sin correo registrado)`);
    }
    if (resultado.omitidas) {
      partes.push(`${resultado.omitidas} omitidas (sin PDF vigente, o sin correo y sin correo de respaldo)`);
    }
    setMensaje(`${partes.join(", ")}.`);
    if (resultado.loteId) setLoteId(resultado.loteId);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={enviarTodos} disabled={!periodoId || cargando}>
        {cargando ? "Encolando..." : "Envíos de correos de todo el período"}
      </Button>
      {mensaje ? <p className="max-w-xs text-right text-xs text-muted-foreground">{mensaje}</p> : null}
      {loteId ? (
        <Link href={`/prefacturas/lotes/${loteId}`} className="text-xs text-primary-ink hover:underline">
          Ver progreso del lote
        </Link>
      ) : null}
    </div>
  );
}
