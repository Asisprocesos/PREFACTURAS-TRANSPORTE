"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "./button";

/**
 * Vuelve a la pantalla anterior del navegador (de donde sea que haya
 * llegado el usuario: lista, buscador, filtros aplicados, etc.), en vez de
 * forzarlo a pasar de nuevo por el módulo del menú. `fallbackHref` cubre el
 * caso de que no haya historial (ej. entró por un enlace directo).
 */
export function BotonVolver({
  fallbackHref,
  etiqueta = "Volver",
}: {
  fallbackHref: string;
  etiqueta?: string;
}) {
  const router = useRouter();

  function volver() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={volver} className="-ml-3">
      <ArrowLeft className="h-4 w-4" />
      {etiqueta}
    </Button>
  );
}
