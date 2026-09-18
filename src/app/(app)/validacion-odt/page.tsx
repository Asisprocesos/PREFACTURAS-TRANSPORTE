import Link from "next/link";

import { requireRole } from "@/lib/auth/roles";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";

import { BuscadorValidacion } from "./buscador-validacion";

export default async function ValidacionOdtPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const periodos = await listarPeriodosParaSelect();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Validación ODT</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Busca una placa y un período para ver su cabecera, resumen por centro de costo y detalle de ODT (la
          misma vista de la prefactura).
        </p>
      </div>
      <BuscadorValidacion periodos={periodos} />
      <p className="text-sm text-muted-foreground">
        ¿Vas a comparar contra las ODT físicas?{" "}
        <Link href="/validacion-odt/escaneo" className="text-primary hover:underline">
          Ir a Escaneo de ODT
        </Link>
        .
      </p>
    </div>
  );
}
