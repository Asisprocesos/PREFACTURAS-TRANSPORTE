import Link from "next/link";

import { Button } from "./button";

/**
 * Banner que aparece cuando se llega a esta pantalla desde un enlace
 * "Corregir" del asistente de importación (ver `resultados-validacion.tsx`)
 * — deja al usuario volver a la fila que estaba corrigiendo sin tener que
 * buscarla de nuevo. La fila se revalida automáticamente al volver (query
 * param `revalidarFila` que lee `DetalleImportacion`), así que no hace
 * falta ningún otro paso aquí: solo dar la opción de regresar cuando ya
 * terminó la corrección.
 */
export function VolverAImportacion({ volver }: { volver?: string }) {
  if (!volver) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <span>Estás corrigiendo un dato pendiente de una importación.</span>
      <Button asChild size="sm">
        <Link href={volver}>Volver a la importación</Link>
      </Button>
    </div>
  );
}
