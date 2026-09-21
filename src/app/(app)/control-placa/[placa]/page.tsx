import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
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

  const novedades = periodo ? await obtenerNovedadesPrefactura(placa, periodo) : [];

  return (
    <div className="space-y-6">
      <BotonVolver fallbackHref="/control-placa" />
      <div>
        <h1 className="titulo-marca text-2xl">{placa}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Novedades del período.</p>
      </div>
      <ListaNovedades novedades={novedades} soloLectura={perfil.rol === "CONSULTA"} />
    </div>
  );
}
