import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";

import { FormularioImportarMaestros } from "./formulario-importar-maestros";

export default async function ImportarMaestrosPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BotonVolver fallbackHref="/transportistas" />
      <div>
        <h1 className="titulo-marca text-2xl">Carga masiva de Vehículos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Una sola hoja, una fila por vehículo: incluye los datos del transportista dueño, el vehículo y su
          conductor. La Placa identifica a cada vehículo y el RUC a cada transportista: si ya existen se
          actualizan sus datos, si no, se crean. Los correos de contacto solo se agregan, nunca se borran.
        </p>
      </div>
      <FormularioImportarMaestros />
    </div>
  );
}
