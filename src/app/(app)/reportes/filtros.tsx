"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function FiltrosReportes({
  periodos,
  transportistas,
}: {
  periodos: { id: string; nombre: string }[];
  transportistas: { id: string; razon_social: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function actualizar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    router.push(`/reportes?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={searchParams.get("periodo") ?? ""}
        onChange={(e) => actualizar("periodo", e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Elige un período</option>
        {periodos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("transportista") ?? ""}
        onChange={(e) => actualizar("transportista", e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todos los transportistas</option>
        {transportistas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.razon_social}
          </option>
        ))}
      </select>
    </div>
  );
}
