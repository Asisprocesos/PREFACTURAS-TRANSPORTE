import { defaultAppConfig } from "@/config/app.config";
import { requireRole } from "@/lib/auth/roles";
import { listarPeriodosAdmin } from "@/lib/periodos/queries";

import { ArchivarAntiguosButton } from "./archivar-antiguos-button";
import { PeriodosTabla } from "./periodos-tabla";

export default async function ConfiguracionPage() {
  await requireRole(["ADMIN"]);
  const periodos = await listarPeriodosAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Configuración</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cierre y archivo de períodos. Los demás parámetros de la aplicación se administran en{" "}
          <code>config/app.config.ts</code> y en la tabla <code>configuracion</code> (overrides), ver{" "}
          <code>docs/arquitectura.md</code>.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Períodos</h2>
        <p className="text-sm text-muted-foreground">
          Cerrar bloquea la edición operativa del período (falla si quedan novedades de severidad error sin
          resolver). Archivar solo está disponible para períodos cerrados y genera un respaldo .xlsx en el
          bucket <code>archivo</code> antes de marcarlo como archivado.
        </p>
        <PeriodosTabla periodos={periodos} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Archivo automático</h2>
        <ArchivarAntiguosButton periodosCalientes={defaultAppConfig.periodo.periodosCalientes} />
      </section>
    </div>
  );
}
