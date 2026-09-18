import { requireRole } from "@/lib/auth/roles";
import { listarLogEjecucion } from "@/lib/log-ejecucion/queries";
import type { EstadoLogEjecucion, EtapaLogEjecucion } from "@/types/database.types";

import { FiltrosHistorial } from "./filtros";
import { TablaHistorial } from "./tabla";

const TAMANO_PAGINA = 30;

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; guia?: string; etapa?: string; estado?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);

  const { filas, total } = await listarLogEjecucion({
    pagina,
    tamanoPagina: TAMANO_PAGINA,
    guia: params.guia,
    etapa: params.etapa as EtapaLogEjecucion | undefined,
    estado: params.estado as EstadoLogEjecucion | undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Log de ejecuciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estado de cada ODT a través de importación, validación, generación de PDF y envío de correo.
        </p>
      </div>
      <FiltrosHistorial />
      <TablaHistorial filas={filas} total={total} pagina={pagina} tamanoPagina={TAMANO_PAGINA} />
    </div>
  );
}
