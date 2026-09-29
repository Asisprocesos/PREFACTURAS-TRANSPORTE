import { requireRole } from "@/lib/auth/roles";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";
import { listarLogEjecucion } from "@/lib/log-ejecucion/queries";
import type { EstadoLogEjecucion, EtapaLogEjecucion } from "@/types/database.types";

import { FiltrosHistorial } from "./filtros";
import { TablaHistorial } from "./tabla";

const TAMANO_PAGINA = 30;

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; guia?: string; etapa?: string; estado?: string; periodo?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);

  const periodos = await listarPeriodosParaSelect();
  // log_ejecucion no tiene periodo_id propio (registra por fecha de
  // ejecución, no por el corte de la ODT); el filtro de período acota por el
  // rango de fechas de ese corte, que es la aproximación útil en la
  // práctica: la ejecución (importar/validar/generar PDF/enviar) siempre
  // ocurre durante o poco después del período al que pertenece la ODT.
  const periodoSeleccionado = params.periodo ? periodos.find((p) => p.id === params.periodo) : undefined;

  const { filas, total } = await listarLogEjecucion({
    pagina,
    tamanoPagina: TAMANO_PAGINA,
    guia: params.guia,
    etapa: params.etapa as EtapaLogEjecucion | undefined,
    estado: params.estado as EstadoLogEjecucion | undefined,
    desde: periodoSeleccionado?.fecha_inicio,
    // fecha_fin es un date (sin hora): comparado tal cual contra el
    // timestamptz de log_ejecucion.fecha dejaría fuera todo ese último día.
    hasta: periodoSeleccionado ? `${periodoSeleccionado.fecha_fin}T23:59:59.999Z` : undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Log de ejecuciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estado de cada ODT a través de importación, validación, generación de PDF y envío de correo.
        </p>
      </div>
      <FiltrosHistorial periodos={periodos} />
      <TablaHistorial filas={filas} total={total} pagina={pagina} tamanoPagina={TAMANO_PAGINA} />
    </div>
  );
}
