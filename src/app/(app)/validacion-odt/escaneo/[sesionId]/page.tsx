import { notFound } from "next/navigation";

import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { listarEscaneosSesion, obtenerMatchSesion, obtenerSesionEscaneo } from "@/lib/escaneo/queries";

import { PanelEscaneo } from "./panel-escaneo";

export default async function SesionEscaneoPage({ params }: { params: Promise<{ sesionId: string }> }) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const { sesionId } = await params;

  const sesion = await obtenerSesionEscaneo(sesionId);
  if (!sesion) notFound();

  const [escaneos, { filas: match, resumenValor }] = await Promise.all([
    listarEscaneosSesion(sesionId),
    obtenerMatchSesion(sesionId),
  ]);

  return (
    <div className="space-y-6">
      <BotonVolver fallbackHref="/validacion-odt/escaneo" />
      <div>
        <h1 className="titulo-marca text-2xl">Sesión de escaneo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sesion.placa ? `Placa ${sesion.placa}` : "Todas las placas del período"} ·{" "}
          {sesion.finalizada_en ? "Finalizada" : "En curso"}
        </p>
      </div>
      <PanelEscaneo
        sesion={sesion}
        escaneosIniciales={escaneos}
        matchInicial={match}
        resumenValorInicial={resumenValor}
      />
    </div>
  );
}
