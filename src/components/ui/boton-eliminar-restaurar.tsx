"use client";

import { useRouter } from "next/navigation";

import { BotonAccionConfirmada } from "./boton-accion-confirmada";

/**
 * Para pantallas de detalle (server component): envuelve
 * BotonAccionConfirmada resolviendo el `useRouter` que un server component
 * no puede usar directamente. Eliminar redirige al listado (ya no tiene
 * sentido seguir en el detalle de algo que acabas de ocultar); Restaurar se
 * queda en la misma pantalla y la refresca.
 */
export function BotonEliminarORestaurar({
  eliminado,
  nombre,
  onEliminar,
  onRestaurar,
  listadoHref,
}: {
  eliminado: boolean;
  nombre: string;
  onEliminar: () => Promise<{ ok: boolean; error?: string }>;
  onRestaurar: () => Promise<{ ok: boolean; error?: string }>;
  listadoHref: string;
}) {
  const router = useRouter();

  if (eliminado) {
    return (
      <BotonAccionConfirmada
        accion={onRestaurar}
        etiqueta="Restaurar"
        etiquetaCargando="Restaurando..."
        confirmacion1={`¿Restaurar "${nombre}"?`}
        confirmacion2={`Confirma de nuevo: ¿restaurar "${nombre}" y que vuelva a aparecer en listas y selectores?`}
        onExito={() => router.refresh()}
      />
    );
  }

  return (
    <BotonAccionConfirmada
      accion={onEliminar}
      etiqueta="Eliminar"
      etiquetaCargando="Eliminando..."
      variant="destructive"
      confirmacion1={`¿Eliminar "${nombre}"? Dejará de aparecer en listas y selectores.`}
      confirmacion2={`Última confirmación: ¿de verdad quieres eliminar "${nombre}"?`}
      onExito={() => router.push(listadoHref)}
    />
  );
}
