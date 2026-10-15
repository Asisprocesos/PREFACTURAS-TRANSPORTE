import { requireRole } from "@/lib/auth/roles";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";
import { listarPrefacturas } from "@/lib/prefacturas/queries";
import type { EstadoPrefactura } from "@/types/database.types";

import { EliminarPrefacturasPeriodoButton } from "./eliminar-prefacturas-periodo-button";
import { EnviarTodosButton } from "./enviar-todos-button";
import { FiltrosPrefacturas } from "./filtros";
import { GenerarPrefacturasButton } from "./generar-prefacturas-button";
import { GenerarTodosPdfButton } from "./generar-todos-pdf-button";
import { PrefacturasTable } from "./prefacturas-table";

// encolarEnviosAction/encolarTodosDelPeriodoAction (botones "Enviar
// seleccionados" y "Enviar todos del período") pueden descargar varios PDF y
// armar un ZIP para las prefacturas sin correo registrado; heredan este
// límite de la página que los invoca.
export const maxDuration = 60;

const TAMANO_PAGINA = 20;

export default async function PrefacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; periodo?: string; estado?: string; q?: string }>;
}) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);

  const periodos = await listarPeriodosParaSelect();
  const periodoSeleccionado = params.periodo || periodos.find((p) => p.estado === "ABIERTO")?.id;

  const { filas, total } = await listarPrefacturas({
    pagina,
    tamanoPagina: TAMANO_PAGINA,
    periodoId: params.periodo,
    estado: params.estado as EstadoPrefactura | undefined,
    busqueda: params.q,
  });

  const puedeGenerar = perfil.rol === "ADMIN" || perfil.rol === "OPERADOR_TRANSPORTE";
  const nombrePeriodoSeleccionado = periodos.find((p) => p.id === periodoSeleccionado)?.nombre;
  // A diferencia de los otros botones (que caen al período ABIERTO por
  // defecto si no hay filtro), el envío masivo de correos solo debe aparecer
  // cuando el filtro de período tiene una elección explícita — con "Todos
  // los períodos" seleccionado, la tabla muestra prefacturas de varios
  // períodos a la vez y no debe haber ningún botón de envío masivo activo
  // que dé la impresión de actuar sobre lo que se ve en pantalla.
  const periodoFiltroExplicito = params.periodo || undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="titulo-marca text-2xl">Prefacturas</h1>
          <p className="mt-2 text-sm text-muted-foreground">1 prefactura por placa por período.</p>
        </div>
        {puedeGenerar ? (
          <div className="flex flex-wrap items-start justify-end gap-2">
            <GenerarPrefacturasButton periodoId={periodoSeleccionado} />
            <GenerarTodosPdfButton
              periodoId={periodoSeleccionado}
              periodoNombre={nombrePeriodoSeleccionado}
            />
            {periodoFiltroExplicito ? (
              <EnviarTodosButton
                periodoId={periodoFiltroExplicito}
                periodoNombre={nombrePeriodoSeleccionado}
              />
            ) : null}
            {perfil.rol === "ADMIN" ? (
              <EliminarPrefacturasPeriodoButton
                periodoId={periodoSeleccionado}
                periodoNombre={nombrePeriodoSeleccionado}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <FiltrosPrefacturas periodos={periodos} />
      <PrefacturasTable
        filas={filas}
        total={total}
        pagina={pagina}
        tamanoPagina={TAMANO_PAGINA}
        puedeEnviar={puedeGenerar}
      />
    </div>
  );
}
