import { notFound } from "next/navigation";

import { CorreosContacto } from "@/components/contactos/correos-contacto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonEliminar } from "@/components/ui/boton-eliminar";
import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import {
  agregarCorreoTransportista,
  eliminarCorreoTransportista,
  eliminarTransportistaAction,
} from "@/lib/transportistas/actions";
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
      <BotonVolver fallbackHref="/transportistas" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="titulo-marca text-2xl">{transportista.nombre || transportista.razon_social}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {transportista.razon_social} · RUC {transportista.ruc}
          </p>
        </div>
        {!soloLectura ? (
          <BotonEliminar
            onEliminar={eliminarTransportistaAction.bind(null, id)}
            confirmacion={`¿Eliminar "${transportista.nombre || transportista.razon_social}"? Dejará de aparecer en listas y selectores.`}
            redirigirA="/transportistas"
          />
        ) : null}
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
              <dt className="text-muted-foreground">Nombre</dt>
              <dd>{transportista.nombre || "—"}</dd>
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
