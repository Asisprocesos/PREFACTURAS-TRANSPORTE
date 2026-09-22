import { notFound } from "next/navigation";

import { CorreosContacto } from "@/components/contactos/correos-contacto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonEliminar } from "@/components/ui/boton-eliminar";
import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import {
  agregarCorreoVehiculo,
  eliminarCorreoVehiculo,
  eliminarVehiculoAction,
} from "@/lib/vehiculos/actions";
import {
  listarCorreosVehiculo,
  listarHistorialVehiculo,
  listarRegionalesParaSelect,
  listarTransportistasParaSelect,
  obtenerConductorVigente,
  obtenerVehiculo,
} from "@/lib/vehiculos/queries";

import { VehiculoForm } from "../vehiculo-form";
import { ConductorVehiculo } from "./conductor-vehiculo";

const ETIQUETA_ACCION: Record<string, string> = {
  INSERT: "Creado",
  UPDATE: "Modificado",
  DELETE: "Eliminado",
};

export default async function DetalleVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { id } = await params;

  const vehiculo = await obtenerVehiculo(id);
  if (!vehiculo) notFound();

  const [correos, historial, transportistas, regionales, conductorActual] = await Promise.all([
    listarCorreosVehiculo(id),
    listarHistorialVehiculo(id),
    listarTransportistasParaSelect(),
    listarRegionalesParaSelect(),
    obtenerConductorVigente(id),
  ]);

  const soloLectura = perfil.rol === "CONSULTA";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BotonVolver fallbackHref="/vehiculos" />
      <div className="flex items-start justify-between gap-4">
        <h1 className="titulo-marca text-2xl">{vehiculo.placa}</h1>
        {!soloLectura ? (
          <BotonEliminar
            onEliminar={eliminarVehiculoAction.bind(null, id)}
            confirmacion={`¿Eliminar el vehículo ${vehiculo.placa}? Dejará de aparecer en listas y selectores.`}
            redirigirA="/vehiculos"
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del vehículo</CardTitle>
        </CardHeader>
        <CardContent>
          {soloLectura ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Placa</dt>
              <dd>{vehiculo.placa}</dd>
              <dt className="text-muted-foreground">Marca / Modelo</dt>
              <dd>
                {vehiculo.marca ?? "—"} {vehiculo.modelo ?? ""}
              </dd>
              <dt className="text-muted-foreground">Estado</dt>
              <dd>{vehiculo.activo ? "Activo" : "Inactivo"}</dd>
            </dl>
          ) : (
            <VehiculoForm vehiculo={vehiculo} transportistas={transportistas} regionales={regionales} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conductor</CardTitle>
        </CardHeader>
        <CardContent>
          <ConductorVehiculo vehiculoId={id} conductorActual={conductorActual} soloLectura={soloLectura} />
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
            agregarAction={agregarCorreoVehiculo.bind(null, id)}
            eliminarAction={eliminarCorreoVehiculo.bind(null, id)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historial de cambios</CardTitle>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cambios registrados todavía.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {historial.map((h) => (
                <li key={h.id} className="border-b pb-2 last:border-0">
                  <span className="font-medium">{ETIQUETA_ACCION[h.accion] ?? h.accion}</span>
                  <span className="ml-2 text-muted-foreground">
                    {new Date(h.fecha).toLocaleString("es-EC")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
