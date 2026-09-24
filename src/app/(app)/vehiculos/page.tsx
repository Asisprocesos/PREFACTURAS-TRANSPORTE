import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ContadorEnVivo } from "@/components/ui/contador-en-vivo";
import { requireRole } from "@/lib/auth/roles";
import { contarVehiculosAction } from "@/lib/vehiculos/actions";
import { listarVehiculos } from "@/lib/vehiculos/queries";

import { VehiculosTable } from "./vehiculos-table";

const TAMANO_PAGINA = 20;

export default async function VehiculosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; papelera?: string }>;
}) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);
  const papelera = params.papelera === "1";

  const { filas, total } = await listarVehiculos({
    pagina,
    tamanoPagina: TAMANO_PAGINA,
    busqueda: params.q,
    eliminados: papelera,
  });

  const puedeGestionar = perfil.rol === "ADMIN" || perfil.rol === "OPERADOR_TRANSPORTE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="titulo-marca text-2xl">{papelera ? "Vehículos eliminados" : "Vehículos"}</h1>
            <ContadorEnVivo
              total={total}
              etiqueta={papelera ? "en papelera" : "activos"}
              obtenerConteo={contarVehiculosAction.bind(null, { eliminados: papelera, busqueda: params.q })}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {papelera
              ? "Registros eliminados: puedes restaurarlos o dejarlos aquí."
              : "Maestro de placas (hoja VEHICULOS)."}
          </p>
        </div>
        <div className="flex gap-2">
          {puedeGestionar ? (
            <Button asChild variant="outline">
              <Link href={papelera ? "/vehiculos" : "/vehiculos?papelera=1"}>
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
                <Link href="/vehiculos/nuevo">Nuevo vehículo</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <VehiculosTable
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
