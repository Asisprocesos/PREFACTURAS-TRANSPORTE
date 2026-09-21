"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nombreTransportista } from "@/lib/transportistas/display";

const ESTADOS = ["VIGENTE", "REEMPLAZADO"] as const;

export function FiltrosRepositorio({
  periodos,
  transportistas,
}: {
  periodos: { id: string; nombre: string }[];
  transportistas: { id: string; razon_social: string; nombre: string | null }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [placa, setPlaca] = useState(searchParams.get("placa") ?? "");
  const [numero, setNumero] = useState(searchParams.get("numero") ?? "");

  function actualizar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    params.set("page", "1");
    router.push(`/repositorio?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <select
        value={searchParams.get("periodo") ?? ""}
        onChange={(e) => actualizar({ periodo: e.target.value })}
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
        value={searchParams.get("transportista") ?? ""}
        onChange={(e) => actualizar({ transportista: e.target.value })}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todos los transportistas</option>
        {transportistas.map((t) => (
          <option key={t.id} value={t.id}>
            {nombreTransportista(t)}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("estado") ?? ""}
        onChange={(e) => actualizar({ estado: e.target.value })}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Vigentes y reemplazados</option>
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
      <Input
        placeholder="Placa"
        value={placa}
        onChange={(e) => setPlaca(e.target.value)}
        onBlur={() => actualizar({ placa })}
        className="w-32"
      />
      <Input
        placeholder="Número de prefactura"
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        onBlur={() => actualizar({ numero })}
        className="w-48"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setPlaca("");
          setNumero("");
          router.push("/repositorio");
        }}
      >
        Limpiar
      </Button>
    </div>
  );
}
