import { requireRole } from "@/lib/auth/roles";
import { buscarOdt } from "@/lib/buscador/queries";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";
import { listarTransportistasParaSelect } from "@/lib/transportistas/queries";

import { FiltrosBuscador } from "./filtros";
import { PaginacionBuscador } from "./paginacion";
import { ResultadosBuscador } from "./resultados-tabla";

export default async function BuscadorPage({
  searchParams,
}: {
  searchParams: Promise<{
    texto?: string;
    placa?: string;
    correo?: string;
    estado?: string;
    periodo?: string;
    transportista?: string;
    desde?: string;
    hasta?: string;
    cursor?: string;
  }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;

  const [periodos, transportistas] = await Promise.all([
    listarPeriodosParaSelect(),
    listarTransportistasParaSelect(),
  ]);

  const { filas, cursorSiguiente } = await buscarOdt(
    {
      texto: params.texto,
      placa: params.placa,
      correo: params.correo,
      estadoFenix: params.estado,
      periodoId: params.periodo,
      transportistaId: params.transportista,
      fechaDesde: params.desde,
      fechaHasta: params.hasta,
    },
    params.cursor,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Buscador</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Búsqueda global de ODT por guía, placa, correo electrónico, transportista, período, estado o fecha.
        </p>
      </div>
      <FiltrosBuscador periodos={periodos} transportistas={transportistas} />
      <ResultadosBuscador filas={filas} />
      <PaginacionBuscador cursorSiguiente={cursorSiguiente} />
    </div>
  );
}
