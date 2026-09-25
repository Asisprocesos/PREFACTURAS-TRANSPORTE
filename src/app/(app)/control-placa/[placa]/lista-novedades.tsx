"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { resolverNovedadAction } from "@/lib/novedades/actions";
import type { Novedad } from "@/lib/prefacturas/queries";

export function ListaNovedades({ novedades, soloLectura }: { novedades: Novedad[]; soloLectura: boolean }) {
  if (novedades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin novedades registradas para esta placa y período.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {novedades.map((n) => (
        <FilaNovedad key={n.id} novedad={n} soloLectura={soloLectura} />
      ))}
    </ul>
  );
}

function FilaNovedad({ novedad, soloLectura }: { novedad: Novedad; soloLectura: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolver(marcarComo: "RESUELTA" | "IGNORADA") {
    setCargando(true);
    setError(null);
    const resultado = await resolverNovedadAction(
      novedad.id,
      motivo || "Sin justificación adicional.",
      marcarComo,
    );
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo actualizar la novedad.");
      return;
    }
    router.refresh();
  }

  const resuelta = novedad.estado !== "ABIERTA";

  return (
    <li className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span
            className={
              novedad.severidad === "ERROR"
                ? "rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
                : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
            }
          >
            {novedad.severidad}
          </span>
          <p className="text-sm">{novedad.mensaje}</p>
          {novedad.accion_sugerida ? (
            <p className="text-xs text-muted-foreground">Acción sugerida: {novedad.accion_sugerida}</p>
          ) : null}
          {resuelta ? (
            <p className="text-xs text-primary-ink">
              {novedad.estado === "RESUELTA" ? "Resuelta" : "Ignorada"}: {novedad.resolucion}
            </p>
          ) : null}
        </div>
        {!soloLectura && !resuelta ? (
          <div className="flex shrink-0 gap-2">
            {novedad.guia ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/odt/${encodeURIComponent(novedad.guia)}/corregir`}>Corregir ODT</Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setMostrarForm((v) => !v)}>
              Resolver
            </Button>
          </div>
        ) : null}
      </div>

      {mostrarForm && !resuelta ? (
        <div className="mt-3 space-y-2 border-t pt-3">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Justificación (obligatoria para marcar como resuelta/ignorada)"
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => resolver("RESUELTA")} disabled={cargando || !motivo.trim()}>
              Marcar como resuelta
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => resolver("IGNORADA")}
              disabled={cargando || !motivo.trim()}
            >
              Ignorar
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
