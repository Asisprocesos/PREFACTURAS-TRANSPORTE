"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { OPCIONES_CATEGORIA_NOVEDAD } from "@/lib/novedades/categorias";

export function FiltrosControlPlaca({
  periodos,
  periodoActual,
}: {
  periodos: { id: string; nombre: string; estado: string }[];
  periodoActual: string | undefined;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function actualizar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    router.push(`/control-placa?${params.toString()}`);
  }

  const hayFiltrosNovedad = !!(searchParams.get("severidad") || searchParams.get("categoria"));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <select
        value={periodoActual ?? ""}
        onChange={(e) => actualizar({ periodo: e.target.value })}
        className="h-10 max-w-xs rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Elige un período</option>
        {periodos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} ({p.estado})
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("severidad") ?? ""}
        onChange={(e) => actualizar({ severidad: e.target.value })}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todas las novedades</option>
        <option value="ERROR">Con errores</option>
        <option value="ADVERTENCIA">Con advertencias</option>
        <option value="SIN_NOVEDADES">Sin novedades</option>
      </select>
      <select
        value={searchParams.get("categoria") ?? ""}
        onChange={(e) => actualizar({ categoria: e.target.value })}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todos los tipos de novedad</option>
        {OPCIONES_CATEGORIA_NOVEDAD.map((c) => (
          <option key={c.id} value={c.id}>
            {c.etiqueta}
          </option>
        ))}
      </select>
      {hayFiltrosNovedad ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => actualizar({ severidad: "", categoria: "" })}
        >
          Limpiar filtros de novedad
        </Button>
      ) : null}
    </div>
  );
}
