import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Importacion } from "@/lib/importador/queries";

import { BotonEliminarImportacion } from "./boton-eliminar-importacion";

const ETIQUETA_ESTADO: Record<string, string> = {
  BORRADOR: "Borrador",
  VALIDADA: "Validada",
  CONFIRMADA: "Confirmada",
  REVERTIDA: "Revertida",
};

export function ImportacionesRecientes({
  importaciones,
  esAdmin,
}: {
  importaciones: Importacion[];
  esAdmin: boolean;
}) {
  if (importaciones.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Importaciones recientes</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {importaciones.map((imp) => (
            <li key={imp.id} className="flex items-center justify-between gap-4 py-2">
              <div>
                <Link href={`/importar/${imp.id}`} className="font-medium text-primary-ink hover:underline">
                  {imp.archivo}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {imp.filas_leidas} filas · {imp.filas_validas} válidas · {imp.filas_con_error} con error ·{" "}
                  {imp.filas_advertencias} con advertencia
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {ETIQUETA_ESTADO[imp.estado] ?? imp.estado}
                </span>
                {esAdmin ? (
                  <BotonEliminarImportacion
                    importacionId={imp.id}
                    archivo={imp.archivo}
                    alEliminar="listado"
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
