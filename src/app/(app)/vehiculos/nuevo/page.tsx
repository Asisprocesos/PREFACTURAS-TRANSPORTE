import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonVolver } from "@/components/ui/boton-volver";
import { VolverAImportacion } from "@/components/ui/volver-a-importacion";
import { requireRole } from "@/lib/auth/roles";
import { listarRegionalesParaSelect, listarTransportistasParaSelect } from "@/lib/vehiculos/queries";

import { VehiculoForm } from "../vehiculo-form";

export default async function NuevoVehiculoPage({
  searchParams,
}: {
  searchParams: Promise<{ placa?: string; volver?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const { placa, volver } = await searchParams;
  const [transportistas, regionales] = await Promise.all([
    listarTransportistasParaSelect(),
    listarRegionalesParaSelect(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BotonVolver fallbackHref="/vehiculos" />
      <VolverAImportacion volver={volver} />
      <h1 className="titulo-marca text-2xl">Nuevo vehículo</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del vehículo</CardTitle>
        </CardHeader>
        <CardContent>
          <VehiculoForm
            transportistas={transportistas}
            regionales={regionales}
            placaInicial={placa}
            volverA={volver}
          />
        </CardContent>
      </Card>
    </div>
  );
}
