import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";

import { IngresoManualForm } from "./ingreso-manual-form";

export default async function IngresoManualPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const params = await searchParams;
  const periodos = await listarPeriodosParaSelect();
  const periodoInicial = params.periodo || periodos.find((p) => p.estado === "ABIERTO")?.id;

  return (
    <div className="space-y-4">
      <BotonVolver fallbackHref="/prefacturas" />
      <div>
        <h1 className="titulo-marca text-2xl">Ingreso manual de ODT</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Para cargar una o dos prefacturas puntuales sin tener que armar un archivo Excel. Cada ODT pasa por
          las mismas validaciones que la carga masiva y se confirma con la misma lógica.
        </p>
      </div>
      <IngresoManualForm periodos={periodos} periodoInicial={periodoInicial} />
    </div>
  );
}
