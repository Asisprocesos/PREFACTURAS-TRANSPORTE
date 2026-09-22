import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { defaultAppConfig } from "@/config/app.config";
import { construirVariablesPlantilla } from "@/lib/correo/plantilla-variables";
import { obtenerContactosPrefactura } from "@/lib/correo/queries";
import { interpolarPlantilla } from "@/lib/email/plantilla";
import {
  obtenerDetalleOdt,
  obtenerNovedadesPrefactura,
  obtenerPrefactura,
  obtenerResumenFacturacion,
} from "@/lib/prefacturas/queries";
import { nombreTransportista } from "@/lib/transportistas/display";

import { AccionesPdf } from "./acciones-pdf";
import { EnviarCorreoForm } from "./enviar-correo-form";
import { PdfPreview } from "./pdf-preview";

// Los Server Actions de esta página (generar PDF, enviar correo con SMTP)
// heredan el límite de duración de la ruta que los invoca.
export const maxDuration = 60;

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export default async function DetallePrefacturaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { id } = await params;

  const prefactura = await obtenerPrefactura(id);
  if (!prefactura) notFound();

  const [resumen, detalleOdt, todasLasNovedades, contactos] = await Promise.all([
    obtenerResumenFacturacion(id),
    obtenerDetalleOdt(id),
    obtenerNovedadesPrefactura(prefactura.vehiculo?.placa ?? null, prefactura.periodo_id),
    obtenerContactosPrefactura(prefactura.vehiculo?.id ?? null, prefactura.transportista?.id ?? null),
  ]);
  // Esta tarjeta es una alerta de "pendiente por resolver", no un historial:
  // una novedad ya resuelta/ignorada (ver Control por placa) no debe seguir
  // apareciendo aquí.
  const novedades = todasLasNovedades.filter((n) => n.estado === "ABIERTA");

  const variables = construirVariablesPlantilla(prefactura);
  const asuntoInicial = interpolarPlantilla(defaultAppConfig.correo.plantillaIndividual.asunto, variables);
  const cuerpoInicial = interpolarPlantilla(defaultAppConfig.correo.plantillaIndividual.cuerpo, variables);

  return (
    <div className="space-y-6">
      <BotonVolver fallbackHref="/prefacturas" />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <div>
            <h1 className="titulo-marca text-2xl">{prefactura.numero ?? "(sin número)"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {prefactura.vehiculo?.placa} · {nombreTransportista(prefactura.transportista) ?? "—"} ·{" "}
              {prefactura.periodo?.nombre}
            </p>
          </div>
          {prefactura.version_actual > 0 ? (
            <PdfPreview key={prefactura.version_actual} prefacturaId={id} />
          ) : (
            <div className="flex h-[600px] items-center justify-center rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
              Genera el PDF para poder previsualizarlo aquí antes de enviarlo.
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <AccionesPdf prefacturaId={id} tieneVigente={prefactura.version_actual > 0} />
          </div>
          <EnviarCorreoForm
            prefacturaId={id}
            correoPrincipal={contactos.principal}
            correosAdicionales={contactos.adicionales}
            asuntoInicial={asuntoInicial}
            cuerpoInicial={cuerpoInicial}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cabecera</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <dt className="text-muted-foreground">Placa</dt>
            <dd>{prefactura.vehiculo?.placa ?? "—"}</dd>
            <dt className="text-muted-foreground">Transportista</dt>
            <dd>{nombreTransportista(prefactura.transportista) ?? "—"}</dd>
            <dt className="text-muted-foreground">Razón social</dt>
            <dd>{prefactura.transportista?.razon_social ?? "—"}</dd>
            <dt className="text-muted-foreground">RUC</dt>
            <dd>{prefactura.transportista?.ruc ?? "—"}</dd>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>{prefactura.estado}</dd>
            <dt className="text-muted-foreground">Cantidad ODT</dt>
            <dd>{prefactura.cantidad_odt}</dd>
            <dt className="text-muted-foreground">Total ODT</dt>
            <dd>{formatoMoneda.format(prefactura.total_odt)}</dd>
            <dt className="text-muted-foreground">Descuentos</dt>
            <dd>{formatoMoneda.format(prefactura.total_descuentos)}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-semibold">{formatoMoneda.format(prefactura.total)}</dd>
          </dl>
        </CardContent>
      </Card>

      {novedades.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Novedades abiertas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {novedades.map((n) => (
                <li key={n.id} className="border-b pb-2 last:border-0">
                  <span
                    className={
                      n.severidad === "ERROR"
                        ? "mr-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
                        : "mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                    }
                  >
                    {n.severidad}
                  </span>
                  {n.mensaje}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen centro de costo × regional</CardTitle>
        </CardHeader>
        <CardContent>
          {resumen.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos de resumen todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Centro de costo</th>
                    <th className="px-3 py-2 font-medium">Regional</th>
                    <th className="px-3 py-2 font-medium">Ruta</th>
                    <th className="px-3 py-2 font-medium">Cantidad</th>
                    <th className="px-3 py-2 font-medium">Suma</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {resumen.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{r.centro_costo_final ?? "—"}</td>
                      <td className="px-3 py-2">{r.regional ?? "—"}</td>
                      <td className="px-3 py-2">{r.ruta_macro ?? "—"}</td>
                      <td className="px-3 py-2">{r.cantidad}</td>
                      <td className="px-3 py-2">{formatoMoneda.format(r.suma ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalle de ODT</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Guía</th>
                  <th className="px-3 py-2 font-medium">Ruta</th>
                  <th className="px-3 py-2 font-medium">Centro de costo</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detalleOdt.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2">{o.fecha_creacion}</td>
                    <td className="px-3 py-2">{o.guia}</td>
                    <td className="px-3 py-2">{o.ruta ?? o.ruta_macro ?? "—"}</td>
                    <td className="px-3 py-2">{o.centro_costo_final ?? "—"}</td>
                    <td className="px-3 py-2">{formatoMoneda.format(o.valor_final ?? o.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
