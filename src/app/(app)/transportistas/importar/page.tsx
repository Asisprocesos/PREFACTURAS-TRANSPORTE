import { requireRole } from "@/lib/auth/roles";

import { FormularioImportarMaestros } from "./formulario-importar-maestros";

export default async function ImportarMaestrosPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Carga masiva de Transportistas y Vehículos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Descarga la plantilla, complétala (una fila por transportista/vehículo) y vuelve a subirla. El RUC
          identifica a cada transportista y la Placa a cada vehículo: si ya existen se actualizan sus datos,
          si no, se crean. Los correos de contacto solo se agregan, nunca se borran.
        </p>
      </div>
      <FormularioImportarMaestros />
    </div>
  );
}
