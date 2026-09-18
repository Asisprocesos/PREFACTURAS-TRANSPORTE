"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { archivarPeriodoAction, cerrarPeriodoAction, restaurarPeriodoAction } from "@/lib/periodos/actions";
import type { Periodo } from "@/lib/periodos/queries";

const ETIQUETA_ESTADO: Record<string, string> = {
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
  ARCHIVADO: "Archivado",
};

export function PeriodosTabla({ periodos }: { periodos: Periodo[] }) {
  const router = useRouter();
  const [cargando, setCargando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ id: string; texto: string; ok: boolean } | null>(null);

  async function ejecutar(id: string, accion: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setCargando(id);
    setMensaje(null);
    const resultado = await accion(id);
    setCargando(null);
    setMensaje({ id, texto: resultado.ok ? "Listo." : (resultado.error ?? "Error"), ok: resultado.ok });
    if (resultado.ok) router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Período</th>
            <th className="px-4 py-3 font-medium">Rango</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {periodos.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-medium">{p.nombre}</td>
              <td className="px-4 py-3">
                {p.fecha_inicio} — {p.fecha_fin}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {ETIQUETA_ESTADO[p.estado] ?? p.estado}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {p.estado === "ABIERTO" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cargando === p.id}
                      onClick={() => ejecutar(p.id, cerrarPeriodoAction)}
                    >
                      Cerrar período
                    </Button>
                  ) : null}
                  {p.estado === "CERRADO" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cargando === p.id}
                      onClick={() => ejecutar(p.id, archivarPeriodoAction)}
                    >
                      Archivar
                    </Button>
                  ) : null}
                  {p.estado === "ARCHIVADO" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cargando === p.id}
                      onClick={() => ejecutar(p.id, restaurarPeriodoAction)}
                    >
                      Restaurar (modo consulta)
                    </Button>
                  ) : null}
                  {mensaje?.id === p.id ? (
                    <span className={mensaje.ok ? "text-xs text-primary" : "text-xs text-destructive"}>
                      {mensaje.texto}
                    </span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
