import { requireRole } from "@/lib/auth/roles";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";
import { listarPrefacturas } from "@/lib/prefacturas/queries";
import type { EstadoPrefactura } from "@/types/database.types";

import { FiltrosPrefacturas } from "./filtros";
import { GenerarPrefacturasButton } from "./generar-prefacturas-button";
import { PrefacturasTable } from "./prefacturas-table";

const TAMANO_PAGINA = 20;

export default async function PrefacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; periodo?: string; estado?: string }>;
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
  });

  const puedeGenerar = perfil.rol === "ADMIN" || perfil.rol === "OPERADOR_TRANSPORTE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="titulo-marca text-2xl">Prefacturas</h1>
          <p className="mt-2 text-sm text-muted-foreground">1 prefactura por placa por período.</p>
        </div>
        {puedeGenerar ? <GenerarPrefacturasButton periodoId={periodoSeleccionado} /> : null}
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
