import { defaultAppConfig } from "@/config/app.config";
import { VolverAImportacion } from "@/components/ui/volver-a-importacion";
import { listarTipoRutaCentroCosto } from "@/lib/catalogos/tipo-ruta-centro-costo/queries";
import { listarTipoTransportista } from "@/lib/catalogos/tipo-transportista/queries";
import { requireRole } from "@/lib/auth/roles";
import { calcularSiguienteRango } from "@/lib/periodos/nombre";
import { listarPeriodosAdmin } from "@/lib/periodos/queries";

import { ArchivarAntiguosButton } from "./archivar-antiguos-button";
import { CrearPeriodoForm } from "./crear-periodo-form";
import { PeriodosTabla } from "./periodos-tabla";
import { TipoRutaCentroCostoTabla } from "./tipo-ruta-centro-costo-tabla";
import { TipoTransportistaTabla } from "./tipo-transportista-tabla";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tipoRuta?: string; volver?: string }>;
}) {
  await requireRole(["ADMIN"]);
  const { tipoRuta, volver } = await searchParams;
  const [periodos, catalogoTipoRuta, catalogoTipoTransportista] = await Promise.all([
    listarPeriodosAdmin(),
    listarTipoRutaCentroCosto(),
    listarTipoTransportista(),
  ]);

  const ultimoPeriodo = periodos[0] ?? null;
  const siguienteNumero = Math.max(0, ...periodos.map((p) => p.numero)) + 1;
  const sugerenciaRango = ultimoPeriodo ? calcularSiguienteRango(ultimoPeriodo.fecha_fin) : null;

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
        <CrearPeriodoForm siguienteNumero={siguienteNumero} sugerencia={sugerenciaRango} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Archivo automático</h2>
        <ArchivarAntiguosButton periodosCalientes={defaultAppConfig.periodo.periodosCalientes} />
      </section>

      <section id="tipo-ruta-centro-costo" className="space-y-3">
        <h2 className="text-lg font-semibold">Tipo de Ruta → Centro de Costo</h2>
        <p className="text-sm text-muted-foreground">
          Catálogo que usa el importador para asignar el centro de costo de cada ODT según su Tipo de Ruta
          (columna &quot;Tipo de Ruta&quot; del corte). Una fila &quot;requiere revisión&quot; o sin centro de
          costo queda como advertencia al validar, en vez de asignarse automáticamente.
        </p>
        <VolverAImportacion volver={volver} />
        <TipoRutaCentroCostoTabla filas={catalogoTipoRuta} tipoRutaInicial={tipoRuta} />
      </section>

      <section id="tipo-transportista" className="space-y-3">
        <h2 className="text-lg font-semibold">Tipo de Transportista</h2>
        <p className="text-sm text-muted-foreground">
          Catálogo que usa el formulario de Transportista para clasificarlos como FIJO o BACK (u otro tipo que
          agregues aquí). Solo ADMIN puede crear o editar tipos; desde Transportista solo se elige uno ya
          existente.
        </p>
        <TipoTransportistaTabla filas={catalogoTipoTransportista} />
      </section>
    </div>
  );
}
