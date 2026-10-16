import Link from "next/link";

import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { obtenerPrefacturaResumenPlaca } from "@/lib/control-placa/queries";
import { obtenerNovedadesPrefactura } from "@/lib/prefacturas/queries";

import { ListaNovedades } from "./lista-novedades";

export default async function DetalleControlPlacaPage({
  params,
  searchParams,
}: {
  params: Promise<{ placa: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { placa } = await params;
  const { periodo } = await searchParams;

  const [novedades, resumenPrefactura] = await Promise.all([
    periodo ? obtenerNovedadesPrefactura(placa, periodo) : Promise.resolve([]),
    periodo ? obtenerPrefacturaResumenPlaca(placa, periodo) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <BotonVolver fallbackHref="/control-placa" />
      <div>
        <h1 className="titulo-marca text-2xl">{placa}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Novedades del período.</p>
      </div>
      {resumenPrefactura?.avisoDatosMinimos ? (
        <div className="rounded-md border border-amber-400/50 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <p>
            <strong>{resumenPrefactura.avisoDatosMinimos}.</strong> La prefactura{" "}
            {resumenPrefactura.numero ?? "de este período"} se generó con los datos mínimos (placa y nombre);
            el PDF sale con el resto en blanco hasta completar esto.
          </p>
          <p className="mt-1">
            {resumenPrefactura.vehiculoId ? (
              <Link href={`/vehiculos/${resumenPrefactura.vehiculoId}`} className="underline">
                Asignar transportista
              </Link>
            ) : (
              <Link
                href={`/vehiculos/nuevo?placa=${placa}&volver=${encodeURIComponent(
                  `/control-placa/${placa}?periodo=${periodo}`,
                )}`}
                className="underline"
              >
                Registrar vehículo
              </Link>
            )}{" "}
            y vuelve a darle a &quot;Generar prefacturas del período&quot;.
          </p>
        </div>
      ) : null}
      <ListaNovedades novedades={novedades} soloLectura={perfil.rol === "CONSULTA"} />
    </div>
  );
}
