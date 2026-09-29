import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/roles";
import {
  contarPrefacturasSinCorreo,
  obtenerIndicadoresDashboard,
  obtenerMontoPorCentroCosto,
  obtenerMontoPorRegional,
  obtenerPrefacturasPorEstado,
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

  const [indicadores, montoPorCentroCosto, montoPorRegional, topPlacas, porEstado, prefacturasSinCorreo] =
    await Promise.all([
      obtenerIndicadoresDashboard(periodoId ?? null),
      obtenerMontoPorCentroCosto(periodoId ?? null),
      obtenerMontoPorRegional(periodoId ?? null),
      obtenerTopPlacas(periodoId ?? null),
      obtenerPrefacturasPorEstado(periodoId ?? null),
      contarPrefacturasSinCorreo(periodoId ?? null),
    ]);

  const novedadesAbiertas =
    indicadores.novedadesAbiertasError +
    indicadores.novedadesAbiertasAdvertencia +
    indicadores.novedadesAbiertasInfo;
  const prefacturasRequierenRegenerar =
    porEstado.find((p) => p.estado === "REQUIERE_REGENERAR")?.cantidad ?? 0;

  const irAPrefacturas = (estado?: string) =>
    `/prefacturas?periodo=${periodoId}${estado ? `&estado=${estado}` : ""}`;

  const indicadoresPrincipales: {
    titulo: string;
    valor: string;
    destacar?: boolean;
    href?: string;
    nota?: string;
  }[] = [
    {
      titulo: "Total de prefacturas",
      valor: formatoEntero.format(indicadores.totalPrefacturas),
      href: irAPrefacturas(),
    },
    { titulo: "Monto total prefacturado", valor: formatoMoneda.format(indicadores.montoTotalPrefacturado) },
    {
      titulo: "ODT importadas",
      valor: formatoEntero.format(indicadores.totalOdt),
      href: `/buscador?periodo=${periodoId}`,
    },
    {
      titulo: "Novedades abiertas",
      valor: formatoEntero.format(novedadesAbiertas),
      destacar: indicadores.novedadesAbiertasError > 0,
      href: `/control-placa?periodo=${periodoId}${indicadores.novedadesAbiertasError > 0 ? "&severidad=ERROR" : ""}`,
    },
    {
      titulo: "PDF generado",
      valor: formatoEntero.format(indicadores.prefacturasPdfGenerado),
      href: irAPrefacturas("PDF_GENERADO"),
    },
    {
      titulo: "Pendientes de envío",
      valor: formatoEntero.format(indicadores.prefacturasEnColaEnvio),
      href: irAPrefacturas("EN_COLA_ENVIO"),
    },
    {
      titulo: "Enviadas",
      valor: formatoEntero.format(indicadores.prefacturasEnviadas),
      href: irAPrefacturas("ENVIADA"),
    },
    {
      titulo: "Errores de envío",
      valor: formatoEntero.format(indicadores.prefacturasErrorEnvio),
      destacar: indicadores.prefacturasErrorEnvio > 0,
      href: irAPrefacturas("ERROR_ENVIO"),
    },
    {
      titulo: "Requieren regenerar PDF",
      valor: formatoEntero.format(prefacturasRequierenRegenerar),
      destacar: prefacturasRequierenRegenerar > 0,
      href: irAPrefacturas("REQUIERE_REGENERAR"),
    },
    {
      titulo: "Sin correo registrado",
      valor: formatoEntero.format(prefacturasSinCorreo),
      destacar: prefacturasSinCorreo > 0,
      nota: prefacturasSinCorreo > 0 ? "Regístrales un correo en Vehículos o Transportistas." : undefined,
    },
    {
      titulo: "Transportistas activos",
      valor: formatoEntero.format(indicadores.totalTransportistasActivos),
      href: "/transportistas",
    },
    {
      titulo: "Vehículos activos",
      valor: formatoEntero.format(indicadores.totalVehiculosActivos),
      href: "/vehiculos",
    },
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
            {indicadoresPrincipales.map((ind) => {
              const tarjeta = (
                <Card className={ind.href ? "transition-colors hover:bg-accent" : undefined}>
                  <CardHeader className="pb-2">
                    <CardDescription>{ind.titulo}</CardDescription>
                    <CardTitle className={`text-3xl ${ind.destacar ? "text-destructive" : ""}`}>
                      {ind.valor}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ind.nota ? <p className="text-xs text-muted-foreground">{ind.nota}</p> : null}
                  </CardContent>
                </Card>
              );
              return ind.href ? (
                <Link key={ind.titulo} href={ind.href}>
                  {tarjeta}
                </Link>
              ) : (
                <div key={ind.titulo}>{tarjeta}</div>
              );
            })}
          </div>

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
