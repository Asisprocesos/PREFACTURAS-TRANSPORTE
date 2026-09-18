import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/roles";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";

import { FormularioCorreccionMasiva } from "./formulario-correccion-masiva";

export default async function CorreccionMasivaPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const periodos = await listarPeriodosParaSelect();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="titulo-marca text-2xl">Corrección masiva</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reclasificar Tipo de Ruta</CardTitle>
          <CardDescription>
            Ejemplo: las ODT con Tipo de Ruta &quot;REEMPLAZO TRANSPORTE&quot; llegan sin centro de costo
            asignado y hay que reclasificarlas todas juntas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioCorreccionMasiva periodos={periodos} />
        </CardContent>
      </Card>
    </div>
  );
}
