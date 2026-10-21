import Link from "next/link";

import { BotonVolver } from "@/components/ui/boton-volver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CorreosContacto } from "@/components/contactos/correos-contacto";
import { requireRole } from "@/lib/auth/roles";
import { listarSinCorreo } from "@/lib/dashboard/queries";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";
import { agregarCorreoTransportista, eliminarCorreoTransportista } from "@/lib/transportistas/actions";
import { agregarCorreoVehiculo, eliminarCorreoVehiculo } from "@/lib/vehiculos/actions";

export default async function SinCorreoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { periodo } = await searchParams;
  const soloLectura = perfil.rol === "CONSULTA";

  const [periodos, datos] = await Promise.all([listarPeriodosParaSelect(), listarSinCorreo(periodo ?? null)]);
  const periodoNombre = periodos.find((p) => p.id === periodo)?.nombre;

  return (
    <div className="space-y-6">
      <BotonVolver fallbackHref="/dashboard" />
      <div>
        <h1 className="titulo-marca text-2xl">Correos sin registrar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {periodoNombre ? `Período ${periodoNombre}. ` : ""}
          {datos.prefacturasAfectadas} prefactura(s) sin ningún correo registrado (ni en el vehículo ni en el
          transportista). Regístralo acá mismo y vuelve a &quot;Generar prefacturas del período&quot; para que
          se ofrezcan para un envío real.
        </p>
      </div>

      {!periodo ? (
        <p className="text-sm text-muted-foreground">Elige un período desde el Dashboard.</p>
      ) : datos.vehiculos.length === 0 && datos.transportistas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ninguna prefactura de este período está sin correo.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vehículos ({datos.vehiculos.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {datos.vehiculos.map((v) => (
                <div key={v.id} className="space-y-2 rounded-md border p-3">
                  <Link
                    href={`/vehiculos/${v.id}`}
                    className="text-sm font-medium text-primary-ink hover:underline"
                  >
                    {v.etiqueta}
                  </Link>
                  <CorreosContacto
                    correos={[]}
                    soloLectura={soloLectura}
                    agregarAction={agregarCorreoVehiculo.bind(null, v.id)}
                    eliminarAction={eliminarCorreoVehiculo.bind(null, v.id)}
                  />
                </div>
              ))}
              {datos.vehiculos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún vehículo pendiente.</p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transportistas ({datos.transportistas.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {datos.transportistas.map((t) => (
                <div key={t.id} className="space-y-2 rounded-md border p-3">
                  <Link
                    href={`/transportistas/${t.id}`}
                    className="text-sm font-medium text-primary-ink hover:underline"
                  >
                    {t.etiqueta}
                  </Link>
                  <CorreosContacto
                    correos={[]}
                    soloLectura={soloLectura}
                    agregarAction={agregarCorreoTransportista.bind(null, t.id)}
                    eliminarAction={eliminarCorreoTransportista.bind(null, t.id)}
                  />
                </div>
              ))}
              {datos.transportistas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún transportista pendiente.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
