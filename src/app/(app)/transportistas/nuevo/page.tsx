import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { listarTipoTransportista } from "@/lib/catalogos/tipo-transportista/queries";

import { TransportistaForm } from "../transportista-form";

export default async function NuevoTransportistaPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const tiposTransportista = (await listarTipoTransportista()).filter((t) => t.activo);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BotonVolver fallbackHref="/transportistas" />
      <h1 className="titulo-marca text-2xl">Nuevo transportista</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del transportista</CardTitle>
        </CardHeader>
        <CardContent>
          <TransportistaForm tiposTransportista={tiposTransportista} />
        </CardContent>
      </Card>
    </div>
  );
}
