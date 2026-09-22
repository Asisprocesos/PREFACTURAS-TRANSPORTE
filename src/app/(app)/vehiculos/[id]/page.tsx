import { notFound } from "next/navigation";

import { CorreosContacto } from "@/components/contactos/correos-contacto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonEliminarORestaurar } from "@/components/ui/boton-eliminar-restaurar";
import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { nombreTransportista } from "@/lib/transportistas/display";
import {
  agregarCorreoVehiculo,
  eliminarCorreoVehiculo,
  eliminarVehiculoAction,
  restaurarVehiculoAction,
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
  const transportistaAsignado = transportistas.find((t) => t.id === vehiculo.transportista_id) ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BotonVolver fallbackHref="/vehiculos" />
      <div className="flex items-start justify-between gap-4">
        <h1 className="titulo-marca text-2xl">{vehiculo.placa}</h1>
        {!soloLectura ? (
          <BotonEliminarORestaurar
            eliminado={!!vehiculo.deleted_at}
            nombre={vehiculo.placa}
            onEliminar={eliminarVehiculoAction.bind(null, id)}
            onRestaurar={restaurarVehiculoAction.bind(null, id)}
            listadoHref="/vehiculos"
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
              <dt className="text-muted-foreground">Transportista</dt>
              <dd>
                {transportistaAsignado
                  ? `${nombreTransportista(transportistaAsignado)} — RUC ${transportistaAsignado.ruc}`
                  : "—"}
              </dd>
              <dt className="text-muted-foreground">Propietario</dt>
              <dd>{vehiculo.propietario ?? "—"}</dd>
              <dt className="text-muted-foreground">RUC del propietario</dt>
              <dd>{vehiculo.ruc_propietario ?? "—"}</dd>
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
