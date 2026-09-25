"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { listarPrefacturasParaGenerarPdfAction } from "@/lib/prefacturas/actions";

interface Progreso {
  total: number;
  hechos: number;
  exitosos: number;
  errores: { numero: string; error: string }[];
}

/**
 * Genera el PDF de todas las prefacturas del período que todavía lo
 * necesitan: BORRADOR (nunca se generó) o REQUIERE_REGENERAR (una
 * corrección de ODT dejó desactualizado el PDF vigente). Las que ya tienen
 * un PDF vigente y sin cambios (PDF_GENERADO, EN_COLA_ENVIO, ENVIADA,
 * ERROR_ENVIO) se dejan intactas — así se puede repetir sin miedo a
 * generar duplicados ni regenerar de más.
 */
export function GenerarTodosPdfButton({ periodoId }: { periodoId: string | undefined }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<Progreso | null>(null);

  async function generarTodos() {
    if (!periodoId) return;
    setCargando(true);
    setMensaje(null);
    setProgreso(null);

    const pendientes = await listarPrefacturasParaGenerarPdfAction(periodoId);
    if (pendientes.length === 0) {
      setCargando(false);
      setMensaje("No hay PDF pendientes de generar en este período.");
      return;
    }

    const errores: Progreso["errores"] = [];
    let exitosos = 0;
    for (let i = 0; i < pendientes.length; i++) {
      const prefactura = pendientes[i]!;
      setProgreso({ total: pendientes.length, hechos: i, exitosos, errores });
      try {
        const respuesta = await fetch(`/api/prefacturas/${prefactura.id}/pdf`, { method: "POST" });
        const cuerpo = await respuesta.json().catch(() => null);
        if (!respuesta.ok) {
          errores.push({
            numero: prefactura.numero ?? prefactura.id,
            error: cuerpo?.error ?? `HTTP ${respuesta.status}`,
          });
        } else {
          exitosos++;
        }
      } catch {
        errores.push({
          numero: prefactura.numero ?? prefactura.id,
          error: "Se perdió la conexión con el servidor.",
        });
      }
    }

    setProgreso({ total: pendientes.length, hechos: pendientes.length, exitosos, errores });
    setCargando(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={generarTodos} disabled={!periodoId || cargando}>
        {cargando ? "Generando PDFs..." : "Generar todos los PDF del período"}
      </Button>
      {mensaje ? <p className="text-xs text-muted-foreground">{mensaje}</p> : null}
      {progreso ? (
        <div className="text-right text-xs text-muted-foreground">
          <p>
            {progreso.hechos} / {progreso.total} procesadas · {progreso.exitosos} generados
            {progreso.errores.length > 0 ? ` · ${progreso.errores.length} con error` : ""}
          </p>
          {!cargando && progreso.errores.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-left text-destructive">
              {progreso.errores.map((e, i) => (
                <li key={i}>
                  {e.numero}: {e.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
