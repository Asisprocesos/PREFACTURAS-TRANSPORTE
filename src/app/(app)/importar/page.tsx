import { requireRole } from "@/lib/auth/roles";
import { listarImportacionesRecientes, listarPeriodosParaSelect } from "@/lib/importador/queries";

import { ImportarWizard } from "./importar-wizard";
import { ImportacionesRecientes } from "./importaciones-recientes";

export default async function ImportarPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const [periodos, recientes] = await Promise.all([
    listarPeriodosParaSelect(),
    listarImportacionesRecientes(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Importar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cargar → Leer → Mapear → Validar → Confirmar. El archivo se sube directo a Storage y nunca pasa por
          el body de la API.
        </p>
      </div>
      <ImportarWizard periodos={periodos} />
      <ImportacionesRecientes importaciones={recientes} />
    </div>
  );
}
