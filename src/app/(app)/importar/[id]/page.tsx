import { notFound } from "next/navigation";

import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { obtenerImportacion } from "@/lib/importador/queries";

import { DetalleImportacion } from "./detalle-importacion";

export default async function DetalleImportacionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { id } = await params;

  const importacion = await obtenerImportacion(id);
  if (!importacion) notFound();

  return (
    <div className="space-y-6">
      <BotonVolver fallbackHref="/importar" />
      <div>
        <h1 className="titulo-marca text-2xl">{importacion.archivo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Estado: {importacion.estado}</p>
      </div>
      <DetalleImportacion importacion={importacion} />
    </div>
  );
}
