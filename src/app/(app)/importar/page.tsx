import { requireRole } from "@/lib/auth/roles";
import { listarImportacionesRecientes, listarPeriodosParaSelect } from "@/lib/importador/queries";

import { ImportarWizard } from "./importar-wizard";
import { ImportacionesRecientes } from "./importaciones-recientes";

// validarImportacionAction procesa el archivo completo (parseo + validación
// fila a fila + inserts por lote al staging) en un solo Server Action, que
// hereda este límite de la página que lo invoca. Con archivos de varios
// miles de filas, el límite por defecto de Vercel se queda corto.
export const maxDuration = 60;

export default async function ImportarPage() {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

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
      <ImportarWizard periodos={periodos} esAdmin={perfil.rol === "ADMIN"} />
      <ImportacionesRecientes importaciones={recientes} />
    </div>
  );
}
