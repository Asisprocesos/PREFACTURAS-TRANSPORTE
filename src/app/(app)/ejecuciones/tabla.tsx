"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Paginacion } from "@/components/ui/paginacion";
import { cancelarLoteAction } from "@/lib/ejecuciones/actions";
import { ESTADOS_EN_CURSO } from "@/lib/ejecuciones/estados";
import type { LoteProceso } from "@/lib/ejecuciones/queries";
import { cn } from "@/lib/utils";

const ETIQUETA_TIPO: Record<string, string> = {
  PDF: "PDF masivo",
  CORREO: "Envío de correo",
  MAESTROS: "Carga de maestros",
  VALIDACION: "Validación",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PROCESANDO: "En curso",
  COMPLETADO: "Completado",
  COMPLETADO_CON_ERRORES: "Completado con errores",
  CANCELADO: "Cancelado",
};

const ESTILO_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-muted text-muted-foreground",
  PROCESANDO: "bg-primary/20 text-primary-ink",
  COMPLETADO: "bg-primary/20 text-primary-ink",
  COMPLETADO_CON_ERRORES: "bg-yellow-100 text-yellow-800",
  CANCELADO: "bg-destructive/10 text-destructive",
};

const formatoFecha = new Intl.DateTimeFormat("es-EC", { dateStyle: "short", timeStyle: "short" });

export function TablaEjecuciones({
  filas,
  total,
  pagina,
  tamanoPagina,
  puedeCancelar,
}: {
  filas: LoteProceso[];
  total: number;
  pagina: number;
  tamanoPagina: number;
  puedeCancelar: boolean;
}) {
  const router = useRouter();
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));

  function irAPagina(nuevaPagina: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(nuevaPagina));
    router.push(`/ejecuciones?${params.toString()}`);
  }

  async function cancelar(id: string) {
    if (!confirm("¿Cancelar esta ejecución? Lo que falte procesar no se va a completar.")) return;
    setCancelandoId(id);
    setError(null);
    const resultado = await cancelarLoteAction(id);
    setCancelandoId(null);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo cancelar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
              <th className="px-4 py-3 font-medium">Progreso</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Iniciado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Sin ejecuciones con estos filtros.
                </td>
              </tr>
            ) : (
              filas.map((f) => {
                const procesados = f.exitosos + f.fallidos;
                const porcentaje = f.total > 0 ? Math.round((procesados / f.total) * 100) : 0;
                const enCurso = ESTADOS_EN_CURSO.includes(f.estado);
                return (
                  <tr key={f.id}>
                    <td className="px-4 py-3 font-medium">{ETIQUETA_TIPO[f.tipo] ?? f.tipo}</td>
                    <td className="px-4 py-3">{f.detalle ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {procesados}/{f.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          ESTILO_ESTADO[f.estado] ?? "",
                        )}
                      >
                        {ETIQUETA_ESTADO[f.estado] ?? f.estado}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatoFecha.format(new Date(f.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {f.tipo === "CORREO" ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/prefacturas/lotes/${f.id}`}>Ver</Link>
                          </Button>
                        ) : null}
                        {puedeCancelar && enCurso ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={cancelandoId === f.id}
                            onClick={() => cancelar(f.id)}
                          >
                            {cancelandoId === f.id ? "Cancelando..." : "Cancelar"}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} ejecuciones</span>
        <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiarPagina={irAPagina} />
      </div>
    </div>
  );
}
