import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/roles";
import { listarRegionalesParaSelect, listarTransportistasParaSelect } from "@/lib/vehiculos/queries";

import { VehiculoForm } from "../vehiculo-form";

export default async function NuevoVehiculoPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const [transportistas, regionales] = await Promise.all([
    listarTransportistasParaSelect(),
    listarRegionalesParaSelect(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="titulo-marca text-2xl">Nuevo vehículo</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del vehículo</CardTitle>
        </CardHeader>
        <CardContent>
          <VehiculoForm transportistas={transportistas} regionales={regionales} />
        </CardContent>
      </Card>
    </div>
  );
}
