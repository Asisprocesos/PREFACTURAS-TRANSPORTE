import Link from "next/link";

import type { OdtConRelaciones } from "@/lib/buscador/queries";
import { nombreTransportista } from "@/lib/transportistas/display";

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const formatoFecha = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });

export function ResultadosBuscador({ filas }: { filas: OdtConRelaciones[] }) {
  if (filas.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Sin resultados para estos filtros.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Guía</th>
            <th className="px-4 py-3 font-medium">Placa</th>
            <th className="px-4 py-3 font-medium">Transportista</th>
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium">Estado (Fénix)</th>
            <th className="px-4 py-3 font-medium">Centro de costo</th>
            <th className="px-4 py-3 font-medium">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((odt) => (
            <tr key={odt.id}>
              <td className="px-4 py-3">
                <Link href={`/odt/${odt.guia}/corregir`} className="font-medium text-primary hover:underline">
                  {odt.guia}
                </Link>
                {odt.corregida ? (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">corregida</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {odt.placa_normalizada ? (
                  <Link
                    href={`/control-placa/${odt.placa_normalizada}`}
                    className="text-primary hover:underline"
                  >
                    {odt.placa_normalizada}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">{nombreTransportista(odt.vehiculo?.transportista) ?? "—"}</td>
              <td className="px-4 py-3">{formatoFecha.format(new Date(odt.fecha_creacion))}</td>
              <td className="px-4 py-3">{odt.estado_fenix ?? "—"}</td>
              <td className="px-4 py-3">{odt.centro_costo_final ?? "—"}</td>
              <td className="px-4 py-3">{formatoMoneda.format(odt.valor_final ?? odt.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
