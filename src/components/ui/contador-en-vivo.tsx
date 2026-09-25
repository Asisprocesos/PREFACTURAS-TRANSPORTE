"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Muestra un total (de transportistas, vehículos, etc.) que se refresca solo
 * cada pocos segundos, sin recargar la página — pensado para poder ver en
 * vivo cómo avanza una carga masiva que corre en otra pestaña. Se pausa
 * mientras la pestaña no está visible para no gastar peticiones de más.
 */
export function ContadorEnVivo({
  total,
  etiqueta,
  obtenerConteo,
}: {
  total: number;
  etiqueta: string;
  obtenerConteo: () => Promise<number>;
}) {
  const [conteo, setConteo] = useState(total);
  const obtenerConteoRef = useRef(obtenerConteo);
  obtenerConteoRef.current = obtenerConteo;

  useEffect(() => {
    setConteo(total);
  }, [total]);

  useEffect(() => {
    const intervalo = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const nuevo = await obtenerConteoRef.current();
        setConteo(nuevo);
      } catch {
        // Un fallo de red puntual en el sondeo no debe interrumpir la pantalla.
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-ink">
      {conteo} {etiqueta}
    </span>
  );
}
