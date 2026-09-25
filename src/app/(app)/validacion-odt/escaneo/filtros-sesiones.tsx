"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FiltrosSesionesEscaneo({ periodos }: { periodos: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [placa, setPlaca] = useState(searchParams.get("placa") ?? "");

  function actualizar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    params.set("page", "1");
    router.push(`/validacion-odt/escaneo?${params.toString()}`);
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
      <Input
        placeholder="Placa"
        value={placa}
        onChange={(e) => setPlaca(e.target.value)}
        onBlur={() => actualizar({ placa })}
        className="w-32"
      />
      {searchParams.get("periodo") || searchParams.get("placa") ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setPlaca("");
            router.push("/validacion-odt/escaneo");
          }}
        >
          Limpiar
        </Button>
      ) : null}
    </div>
  );
}
