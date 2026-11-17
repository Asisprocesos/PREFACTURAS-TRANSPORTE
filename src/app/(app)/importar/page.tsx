import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/roles";
import { listarImportacionesRecientes, listarPeriodosParaSelect } from "@/lib/importador/queries";

import { ImportarWizard } from "./importar-wizard";
import { ImportacionesRecientes } from "./importaciones-recientes";

// validarImportacionAction procesa el archivo completo (parseo + validación
// fila a fila + inserts por lote al staging) en un solo Server Action, que
// hereda este límite de la página que lo invoca. Con archivos de 10 000+
// filas, 60s no alcanzaba incluso con los lotes en paralelo (ver
// CONCURRENCIA_LOTES en validar-action.ts) — la función moría a mitad de
// camino sin llegar a lanzar un error, así que en pantalla solo se veía
// "Validando..." volviendo a "Validar" sin ningún cambio.
export const maxDuration = 300;

export default async function ImportarPage() {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const [periodos, recientes] = await Promise.all([
    listarPeriodosParaSelect(),
    listarImportacionesRecientes(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="titulo-marca text-2xl">Importar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cargar → Leer → Mapear → Validar → Confirmar. El archivo se sube directo a Storage y nunca pasa
            por el body de la API.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/buscador">Ver ODT importadas</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/importar/manual">Ingresar ODT manualmente</Link>
          </Button>
        </div>
      </div>
      <ImportarWizard periodos={periodos} esAdmin={perfil.rol === "ADMIN"} />
      <ImportacionesRecientes importaciones={recientes} />
    </div>
  );
}
