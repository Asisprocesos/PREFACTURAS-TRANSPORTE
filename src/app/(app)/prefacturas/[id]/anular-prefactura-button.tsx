"use client";

import { useRouter } from "next/navigation";

import { BotonAccionConfirmada } from "@/components/ui/boton-accion-confirmada";
import { anularPrefacturaAction, reactivarPrefacturaAction } from "@/lib/prefacturas/actions";

export function AnularPrefacturaButton({
  prefacturaId,
  anulada,
}: {
  prefacturaId: string;
  anulada: boolean;
}) {
  const router = useRouter();

  if (anulada) {
    return (
      <BotonAccionConfirmada
        accion={() => reactivarPrefacturaAction(prefacturaId)}
        etiqueta="Reactivar prefactura"
        etiquetaCargando="Reactivando..."
        confirmacion1="¿Reactivar esta prefactura?"
        confirmacion2="Al reactivarla se podrá volver a enviar por correo. ¿Continuar?"
        onExito={() => router.refresh()}
      />
    );
  }

  return (
    <BotonAccionConfirmada
      accion={() => anularPrefacturaAction(prefacturaId)}
      etiqueta="Anular prefactura"
      etiquetaCargando="Anulando..."
      confirmacion1="¿Anular esta prefactura?"
      confirmacion2="Mientras esté anulada no se podrá enviar por correo hasta reactivarla o eliminarla. ¿Continuar?"
      variant="destructive"
      onExito={() => router.refresh()}
    />
  );
}
