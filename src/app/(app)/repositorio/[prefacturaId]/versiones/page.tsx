import { notFound } from "next/navigation";

import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { obtenerPrefactura } from "@/lib/prefacturas/queries";
import { listarVersionesPrefactura } from "@/lib/repositorio/queries";
import { nombreTransportista } from "@/lib/transportistas/display";

import { ListaVersiones } from "./lista-versiones";

export default async function VersionesPrefacturaPage({
  params,
}: {
  params: Promise<{ prefacturaId: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { prefacturaId } = await params;

  const prefactura = await obtenerPrefactura(prefacturaId);
  if (!prefactura) notFound();

  const versiones = await listarVersionesPrefactura(prefacturaId);

  return (
    <div className="space-y-6">
      <BotonVolver fallbackHref="/repositorio" />
      <div>
        <h1 className="titulo-marca text-2xl">Versiones — {prefactura.numero}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {prefactura.vehiculo?.placa} · {nombreTransportista(prefactura.transportista) ?? "—"}
        </p>
      </div>
      <ListaVersiones versiones={versiones} />
    </div>
  );
}
