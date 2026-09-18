import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/roles";
import { listarVehiculos } from "@/lib/vehiculos/queries";

import { VehiculosTable } from "./vehiculos-table";

const TAMANO_PAGINA = 20;

export default async function VehiculosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);

  const { filas, total } = await listarVehiculos({
    pagina,
    tamanoPagina: TAMANO_PAGINA,
    busqueda: params.q,
  });

  const puedeCrear = perfil.rol === "ADMIN" || perfil.rol === "OPERADOR_TRANSPORTE";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="titulo-marca text-2xl">Vehículos</h1>
          <p className="mt-2 text-sm text-muted-foreground">Maestro de placas (hoja VEHICULOS).</p>
        </div>
        {puedeCrear ? (
          <Button asChild>
            <Link href="/vehiculos/nuevo">Nuevo vehículo</Link>
          </Button>
        ) : null}
      </div>
      <VehiculosTable filas={filas} total={total} pagina={pagina} tamanoPagina={TAMANO_PAGINA} />
    </div>
  );
}
