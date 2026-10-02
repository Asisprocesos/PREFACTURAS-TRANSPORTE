"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function FiltroPeriodo({ periodos }: { periodos: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function actualizar(valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set("periodo", valor);
    else params.delete("periodo");
    router.push(`/transportistas/seguimiento?${params.toString()}`);
  }

  return (
    <select
      value={searchParams.get("periodo") ?? ""}
      onChange={(e) => actualizar(e.target.value)}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">Elige un período</option>
      {periodos.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </select>
  );
}
