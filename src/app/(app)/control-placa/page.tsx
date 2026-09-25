import Link from "next/link";

import { requireRole } from "@/lib/auth/roles";
import { obtenerControlPlaca } from "@/lib/control-placa/queries";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";
import { cn } from "@/lib/utils";

import { SelectorPeriodo } from "./selector-periodo";

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export default async function ControlPlacaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const periodos = await listarPeriodosParaSelect();
  const periodoId = params.periodo || periodos.find((p) => p.estado === "ABIERTO")?.id;

  const filas = periodoId ? await obtenerControlPlaca(periodoId) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="titulo-marca text-2xl">Control por placa</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Semáforo de novedades por placa del período: total, ODT y novedades abiertas.
          </p>
        </div>
        <Link href="/control-placa/correccion-masiva" className="text-sm text-primary-ink hover:underline">
          Corrección masiva →
        </Link>
      </div>

      <SelectorPeriodo periodos={periodos} periodoActual={periodoId} />

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Placa</th>
              <th className="px-4 py-3 font-medium">Prefactura</th>
              <th className="px-4 py-3 font-medium">ODT</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Novedades</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  {periodoId ? "Sin actividad en este período." : "Elige un período."}
                </td>
              </tr>
            ) : (
              filas.map((f) => {
                const color =
                  f.novedadesError > 0
                    ? "bg-destructive"
                    : f.novedadesAdvertencia > 0
                      ? "bg-amber-500"
                      : "bg-primary";
                return (
                  <tr key={f.placa}>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/control-placa/${f.placa}?periodo=${periodoId}`}
                        className="text-primary-ink hover:underline"
                      >
                        {f.placa}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{f.numero ?? "(sin generar)"}</td>
                    <td className="px-4 py-3">{f.cantidadOdt ?? "—"}</td>
                    <td className="px-4 py-3">{f.total !== null ? formatoMoneda.format(f.total) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
                        {f.novedadesError + f.novedadesAdvertencia === 0
                          ? "Sin novedades"
                          : `${f.novedadesError} errores, ${f.novedadesAdvertencia} advertencias`}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
