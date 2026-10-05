"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TIPOS = [
  { valor: "PDF", etiqueta: "PDF masivo" },
  { valor: "CORREO", etiqueta: "Envío de correo" },
  { valor: "MAESTROS", etiqueta: "Carga de maestros" },
];

const ESTADOS = [
  { valor: "PENDIENTE", etiqueta: "Pendiente" },
  { valor: "PROCESANDO", etiqueta: "En curso" },
  { valor: "COMPLETADO", etiqueta: "Completado" },
  { valor: "COMPLETADO_CON_ERRORES", etiqueta: "Completado con errores" },
  { valor: "CANCELADO", etiqueta: "Cancelado" },
];

export function FiltrosEjecuciones() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function actualizar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    params.set("page", "1");
    router.push(`/ejecuciones?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={searchParams.get("tipo") ?? ""}
        onChange={(e) => actualizar("tipo", e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todos los tipos</option>
        {TIPOS.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.etiqueta}
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
          <option key={e.valor} value={e.valor}>
            {e.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}
