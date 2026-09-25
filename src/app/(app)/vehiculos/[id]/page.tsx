import Link from "next/link";
import { notFound } from "next/navigation";

import { CorreosContacto } from "@/components/contactos/correos-contacto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonEliminarORestaurar } from "@/components/ui/boton-eliminar-restaurar";
import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { agregarCorreoTransportista, eliminarCorreoTransportista } from "@/lib/transportistas/actions";
import { nombreTransportista } from "@/lib/transportistas/display";
import { listarCorreosTransportista, obtenerTransportista } from "@/lib/transportistas/queries";
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

import { TransportistaForm } from "../../transportistas/transportista-form";
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

  // Ficha combinada: además de sus propios datos, el detalle del vehículo
  // muestra y permite editar los del transportista dueño en la misma
  // pantalla, para no tener que saltar entre los dos módulos.
  const [transportistaCompleto, correosTransportista] = vehiculo.transportista_id
    ? await Promise.all([
        obtenerTransportista(vehiculo.transportista_id),
        listarCorreosTransportista(vehiculo.transportista_id),
      ])
    : [null, []];

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
          <CardTitle className="text-lg">Datos del transportista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!transportistaCompleto ? (
            <p className="text-sm text-muted-foreground">
              Este vehículo no tiene transportista asignado.{" "}
              {!soloLectura ? (
                <>
                  Selecciona uno en el campo &quot;Transportista&quot; de arriba, o{" "}
                  <Link href="/transportistas/nuevo" className="text-primary-ink hover:underline">
                    crea uno nuevo
                  </Link>
                  .
                </>
              ) : null}
            </p>
          ) : soloLectura ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">RUC</dt>
              <dd>{transportistaCompleto.ruc}</dd>
              <dt className="text-muted-foreground">Nombre</dt>
              <dd>{transportistaCompleto.nombre || "—"}</dd>
              <dt className="text-muted-foreground">Razón social</dt>
              <dd>{transportistaCompleto.razon_social}</dd>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd>{transportistaCompleto.tipo_transportista ?? "—"}</dd>
              <dt className="text-muted-foreground">Estado</dt>
              <dd>{transportistaCompleto.activo ? "Activo" : "Inactivo"}</dd>
            </dl>
          ) : (
            <TransportistaForm transportista={transportistaCompleto} />
          )}
          {transportistaCompleto ? (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Correos del transportista</p>
              <CorreosContacto
                correos={correosTransportista}
                soloLectura={soloLectura}
                agregarAction={agregarCorreoTransportista.bind(null, transportistaCompleto.id)}
                eliminarAction={eliminarCorreoTransportista.bind(null, transportistaCompleto.id)}
              />
            </div>
          ) : null}
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
          <CardTitle className="text-lg">Correos del vehículo</CardTitle>
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
