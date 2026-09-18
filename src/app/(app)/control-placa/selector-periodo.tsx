"use client";

import { useRouter } from "next/navigation";

export function SelectorPeriodo({
  periodos,
  periodoActual,
}: {
  periodos: { id: string; nombre: string; estado: string }[];
  periodoActual: string | undefined;
}) {
  const router = useRouter();

  return (
    <select
      value={periodoActual ?? ""}
      onChange={(e) => router.push(`/control-placa?periodo=${e.target.value}`)}
      className="h-10 max-w-xs rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">Elige un período</option>
      {periodos.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre} ({p.estado})
        </option>
      ))}
    </select>
  );
}
