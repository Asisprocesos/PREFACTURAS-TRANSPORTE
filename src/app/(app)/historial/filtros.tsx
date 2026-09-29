"use client";

import { useRouter, useSearchParams } from "next/navigation";

const ETAPAS = ["IMPORTACION", "VALIDACION", "PDF", "CORREO"] as const;
const ESTADOS = ["OK", "ADVERTENCIA", "ERROR"] as const;

export function FiltrosHistorial({ periodos }: { periodos: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function actualizar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    params.set("page", "1");
    router.push(`/historial?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="text"
        defaultValue={searchParams.get("guia") ?? ""}
        onBlur={(e) => actualizar("guia", e.target.value)}
        placeholder="Buscar guía..."
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      />
      <select
        value={searchParams.get("periodo") ?? ""}
        onChange={(e) => actualizar("periodo", e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todos los períodos</option>
        {periodos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("etapa") ?? ""}
        onChange={(e) => actualizar("etapa", e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todas las etapas</option>
        {ETAPAS.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("estado") ?? ""}
        onChange={(e) => actualizar("estado", e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todos los resultados</option>
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
    </div>
  );
}
