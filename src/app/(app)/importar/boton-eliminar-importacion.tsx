"use client";

import { useRouter } from "next/navigation";

import { BotonAccionConfirmada } from "@/components/ui/boton-accion-confirmada";
import { eliminarImportacionAction } from "@/lib/importador/confirmar-action";

/**
 * A diferencia de "Revertir" (deja el registro marcado REVERTIDA), esto
 * borra la importación por completo — ODT, prefacturas sin otra ODT,
 * novedades, el archivo en Storage y la fila misma — para que re-subir el
 * mismo archivo después no choque con un registro muerto (ver
 * eliminar_importacion). No se puede deshacer, por eso usa la doble
 * confirmación de BotonAccionConfirmada.
 */
export function BotonEliminarImportacion({
  importacionId,
  archivo,
  alEliminar,
}: {
  importacionId: string;
  archivo: string;
  /** "listado": se queda en la pantalla y la refresca. "detalle": ya no tiene sentido seguir viendo algo que se acaba de borrar, así que vuelve a /importar. */
  alEliminar: "listado" | "detalle";
}) {
  const router = useRouter();

  return (
    <BotonAccionConfirmada
      accion={() => eliminarImportacionAction(importacionId)}
      etiqueta="Eliminar"
      etiquetaCargando="Eliminando..."
      variant="destructive"
      size="sm"
      confirmacion1={`¿Eliminar definitivamente la importación "${archivo}"? Se borrarán también las ODT y prefacturas que generó (si ninguna tiene ya un correo ENVIADO), y el archivo original.`}
      confirmacion2="Esta acción NO se puede deshacer, ni siquiera volviendo a importar el mismo archivo. ¿Confirmas que quieres eliminarla por completo?"
      onExito={() => (alEliminar === "detalle" ? router.push("/importar") : router.refresh())}
    />
  );
}
