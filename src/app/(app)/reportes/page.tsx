import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/roles";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";
import { listarTransportistasParaSelect } from "@/lib/transportistas/queries";

import { FiltrosReportes } from "./filtros";

const REPORTES = [
  {
    tipo: "prefacturas",
    titulo: "Prefacturas del período",
    descripcion:
      "Todas las prefacturas del período (o de un transportista), con el total facturado por fila.",
    usaTransportista: true,
  },
  {
    tipo: "enviadas",
    titulo: "Prefacturas enviadas",
    descripcion: "Solo las prefacturas ya enviadas por correo en el período.",
    usaTransportista: true,
  },
  {
    tipo: "pendientes",
    titulo: "Prefacturas pendientes de envío",
    descripcion:
      "Prefacturas que todavía no llegan a estado Enviada (borrador, con novedades, lista, PDF, en cola).",
    usaTransportista: true,
  },
  {
    tipo: "errores-envio",
    titulo: "Errores de envío",
    descripcion: "Prefacturas en estado Error de envío, con el último mensaje de error registrado.",
    usaTransportista: true,
  },
  {
    tipo: "centro-costo",
    titulo: "Resumen por centro de costo",
    descripcion: "Monto y cantidad de ODT facturadas por centro de costo final en el período.",
    usaTransportista: false,
  },
  {
    tipo: "rezagos",
    titulo: "Rezagos",
    descripcion:
      "ODT cuya fecha de creación cayó fuera del rango del período (novedad de fecha fuera de corte), con la resolución elegida por el operador.",
    usaTransportista: false,
  },
  {
    tipo: "placas-sin-vehiculo",
    titulo: "Placas sin vehículo",
    descripcion:
      "Placas del período que no coincidieron con ningún vehículo registrado (se facturaron igual). Úsalo para armar la plantilla de carga masiva de Vehículos con lo que falte.",
    usaTransportista: false,
  },
] as const;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; transportista?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;

  const [periodos, transportistas] = await Promise.all([
    listarPeriodosParaSelect(),
    listarTransportistasParaSelect(),
  ]);

  const periodoId = params.periodo || periodos.find((p) => p.estado === "ABIERTO")?.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Reportes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reportes exportables a Excel. El monto total del período se obtiene sumando la columna Total del
          reporte de prefacturas. El resultado de escaneo de ODT se exporta desde{" "}
          <Link href="/validacion-odt/escaneo" className="text-primary hover:underline">
            Validación ODT / Escaneo
          </Link>
          , por sesión.
        </p>
      </div>

      <FiltrosReportes periodos={periodos} transportistas={transportistas} />

      {!periodoId ? (
        <p className="text-sm text-muted-foreground">Elige un período para habilitar las descargas.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTES.map((r) => {
            const href = new URLSearchParams({ tipo: r.tipo, periodo: periodoId });
            if (r.usaTransportista && params.transportista) href.set("transportista", params.transportista);
            return (
              <Card key={r.tipo}>
                <CardHeader>
                  <CardTitle className="text-base">{r.titulo}</CardTitle>
                  <CardDescription>{r.descripcion}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild size="sm">
                    <a href={`/api/reportes?${href.toString()}`}>Descargar Excel</a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
