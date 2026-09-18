"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export function PaginacionBuscador({ cursorSiguiente }: { cursorSiguiente: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function irSiguiente() {
    if (!cursorSiguiente) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("cursor", cursorSiguiente);
    router.push(`/buscador?${params.toString()}`);
  }

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => router.back()}>
        Anterior
      </Button>
      <Button variant="outline" size="sm" onClick={irSiguiente} disabled={!cursorSiguiente}>
        Siguiente
      </Button>
    </div>
  );
}
