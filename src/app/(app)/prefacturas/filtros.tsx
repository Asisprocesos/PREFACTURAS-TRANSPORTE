"use client";

import { useRouter, useSearchParams } from "next/navigation";

const ESTADOS = [
  "BORRADOR",
  "CON_NOVEDADES",
  "LISTA",
  "PDF_GENERADO",
  "EN_COLA_ENVIO",
  "ENVIADA",
  "ERROR_ENVIO",
  "REQUIERE_REGENERAR",
  "ANULADA",
] as const;

export function FiltrosPrefacturas({ periodos }: { periodos: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function actualizar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    params.set("page", "1");
    router.push(`/prefacturas?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
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
        value={searchParams.get("estado") ?? ""}
        onChange={(e) => actualizar("estado", e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todos los estados</option>
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
    </div>
  );
}
