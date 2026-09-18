import { notFound } from "next/navigation";

import { CorreosContacto } from "@/components/contactos/correos-contacto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/roles";
import { agregarCorreoTransportista, eliminarCorreoTransportista } from "@/lib/transportistas/actions";
import { listarCorreosTransportista, obtenerTransportista } from "@/lib/transportistas/queries";

import { TransportistaForm } from "../transportista-form";

export default async function DetalleTransportistaPage({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { id } = await params;

  const transportista = await obtenerTransportista(id);
  if (!transportista) notFound();

  const correos = await listarCorreosTransportista(id);
  const soloLectura = perfil.rol === "CONSULTA";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">{transportista.razon_social}</h1>
        <p className="mt-1 text-sm text-muted-foreground">RUC {transportista.ruc}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del transportista</CardTitle>
        </CardHeader>
        <CardContent>
          {soloLectura ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">RUC</dt>
              <dd>{transportista.ruc}</dd>
              <dt className="text-muted-foreground">Razón social</dt>
              <dd>{transportista.razon_social}</dd>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd>{transportista.tipo_transportista ?? "—"}</dd>
              <dt className="text-muted-foreground">Estado</dt>
              <dd>{transportista.activo ? "Activo" : "Inactivo"}</dd>
            </dl>
          ) : (
            <TransportistaForm transportista={transportista} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Correos de contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <CorreosContacto
            correos={correos}
            soloLectura={soloLectura}
            agregarAction={agregarCorreoTransportista.bind(null, id)}
            eliminarAction={eliminarCorreoTransportista.bind(null, id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
