import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/roles";
import {
  obtenerIndicadoresDashboard,
  obtenerMontoPorCentroCosto,
  obtenerMontoPorRegional,
  obtenerTopPlacas,
} from "@/lib/dashboard/queries";
import { PALETA_CATEGORICA } from "@/lib/dashboard/paleta";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";

import { GraficoAvanceEnvio, GraficoBarrasMonto } from "./graficos";
import { SelectorPeriodoDashboard } from "./selector-periodo";

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const formatoEntero = new Intl.NumberFormat("es-EC");

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;

  const periodos = await listarPeriodosParaSelect();
  const periodoId = params.periodo || periodos.find((p) => p.estado === "ABIERTO")?.id || periodos[0]?.id;

  const [indicadores, montoPorCentroCosto, montoPorRegional, topPlacas] = await Promise.all([
    obtenerIndicadoresDashboard(periodoId ?? null),
    obtenerMontoPorCentroCosto(periodoId ?? null),
    obtenerMontoPorRegional(periodoId ?? null),
    obtenerTopPlacas(periodoId ?? null),
  ]);

  const novedadesAbiertas =
    indicadores.novedadesAbiertasError +
    indicadores.novedadesAbiertasAdvertencia +
    indicadores.novedadesAbiertasInfo;

  const indicadoresPrincipales = [
    { titulo: "Total de prefacturas", valor: formatoEntero.format(indicadores.totalPrefacturas) },
    { titulo: "Monto total prefacturado", valor: formatoMoneda.format(indicadores.montoTotalPrefacturado) },
    { titulo: "ODT importadas", valor: formatoEntero.format(indicadores.totalOdt) },
    {
      titulo: "Novedades abiertas",
      valor: formatoEntero.format(novedadesAbiertas),
      destacar: indicadores.novedadesAbiertasError > 0,
    },
    { titulo: "PDF generado", valor: formatoEntero.format(indicadores.prefacturasPdfGenerado) },
    { titulo: "Pendientes de envío", valor: formatoEntero.format(indicadores.prefacturasEnColaEnvio) },
    { titulo: "Enviadas", valor: formatoEntero.format(indicadores.prefacturasEnviadas) },
    {
      titulo: "Errores de envío",
      valor: formatoEntero.format(indicadores.prefacturasErrorEnvio),
      destacar: indicadores.prefacturasErrorEnvio > 0,
    },
    { titulo: "Transportistas activos", valor: formatoEntero.format(indicadores.totalTransportistasActivos) },
    { titulo: "Vehículos activos", valor: formatoEntero.format(indicadores.totalVehiculosActivos) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="titulo-marca text-2xl">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">Indicadores del período seleccionado.</p>
        </div>
        {periodos.length > 0 ? (
          <SelectorPeriodoDashboard periodos={periodos} periodoActual={periodoId} />
        ) : null}
      </div>

      {!periodoId ? (
        <p className="text-sm text-muted-foreground">No hay períodos registrados todavía.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {indicadoresPrincipales.map((ind) => (
              <Card key={ind.titulo}>
                <CardHeader className="pb-2">
                  <CardDescription>{ind.titulo}</CardDescription>
                  <CardTitle className={`text-3xl ${ind.destacar ? "text-destructive" : ""}`}>
                    {ind.valor}
                  </CardTitle>
                </CardHeader>
                <CardContent />
              </Card>
            ))}
          </div>

          {indicadores.novedadesAbiertasError > 0 ? (
            <p className="text-sm text-muted-foreground">
              Hay {formatoEntero.format(indicadores.novedadesAbiertasError)} novedad(es) de severidad error
              sin resolver.{" "}
              <Link href="/control-placa" className="text-primary-ink hover:underline">
                Ver en Control por placa
              </Link>
              .
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <GraficoAvanceEnvio
              pendientes={
                indicadores.prefacturasBorrador +
                indicadores.prefacturasConNovedades +
                indicadores.prefacturasListas +
                indicadores.prefacturasPdfGenerado +
                indicadores.prefacturasEnColaEnvio
              }
              enviadas={indicadores.prefacturasEnviadas}
              errores={indicadores.prefacturasErrorEnvio}
            />
            <GraficoBarrasMonto
              titulo="Top 10 placas por monto"
              descripcion="Vehículos con mayor monto facturado en el período."
              datos={topPlacas.map((p) => ({ nombre: p.placa, monto: p.monto }))}
              color={PALETA_CATEGORICA.aqua}
            />
            <GraficoBarrasMonto
              titulo="Monto por centro de costo"
              descripcion="Top 12 centros de costo por monto facturado."
              datos={montoPorCentroCosto.map((p) => ({ nombre: p.nombre, monto: p.monto }))}
              color={PALETA_CATEGORICA.azul}
            />
            <GraficoBarrasMonto
              titulo="Monto por regional"
              descripcion="Monto facturado por regional de origen."
              datos={montoPorRegional.map((p) => ({ nombre: p.nombre, monto: p.monto }))}
              color={PALETA_CATEGORICA.naranja}
            />
          </div>
        </>
      )}
    </div>
  );
}
