import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/roles";
import { listarTransportistas } from "@/lib/transportistas/queries";

import { TransportistasTable } from "./transportistas-table";

const TAMANO_PAGINA = 20;

export default async function TransportistasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; papelera?: string }>;
}) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);
  const papelera = params.papelera === "1";

  const { filas, total } = await listarTransportistas({
    pagina,
    tamanoPagina: TAMANO_PAGINA,
    busqueda: params.q,
    eliminados: papelera,
  });

  const puedeGestionar = perfil.rol === "ADMIN" || perfil.rol === "OPERADOR_TRANSPORTE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="titulo-marca text-2xl">
            {papelera ? "Transportistas eliminados" : "Transportistas"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {papelera
              ? "Registros eliminados: puedes restaurarlos o dejarlos aquí."
              : "Maestro de transportistas (contratista/RUC)."}
          </p>
        </div>
        <div className="flex gap-2">
          {puedeGestionar ? (
            <Button asChild variant="outline">
              <Link href={papelera ? "/transportistas" : "/transportistas?papelera=1"}>
                {papelera ? "Ver activos" : "Ver papelera"}
              </Link>
            </Button>
          ) : null}
          {puedeGestionar && !papelera ? (
            <>
              <Button asChild variant="outline">
                <Link href="/transportistas/importar">Carga masiva</Link>
              </Button>
              <Button asChild>
                <Link href="/transportistas/nuevo">Nuevo transportista</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <TransportistasTable
        filas={filas}
        total={total}
        pagina={pagina}
        tamanoPagina={TAMANO_PAGINA}
        puedeGestionar={puedeGestionar}
        mostrandoEliminados={papelera}
      />
    </div>
  );
}
