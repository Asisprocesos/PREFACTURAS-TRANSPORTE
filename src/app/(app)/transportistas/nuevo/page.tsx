import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";

import { TransportistaForm } from "../transportista-form";

export default async function NuevoTransportistaPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BotonVolver fallbackHref="/transportistas" />
      <h1 className="titulo-marca text-2xl">Nuevo transportista</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del transportista</CardTitle>
        </CardHeader>
        <CardContent>
          <TransportistaForm />
        </CardContent>
      </Card>
    </div>
  );
}
