"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { OdtConDescuento } from "@/lib/prefacturas/queries";

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export function TablaDetalleOdt({
  prefacturaId,
  detalleOdt,
  puedeEditarOdt,
}: {
  prefacturaId: string;
  detalleOdt: OdtConDescuento[];
  puedeEditarOdt: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrado = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return detalleOdt;
    return detalleOdt.filter((o) =>
      [o.guia, o.ruta, o.ruta_macro, o.centro_costo_final]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(termino)),
    );
  }, [detalleOdt, busqueda]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar por guía, ruta o centro de costo..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="max-w-sm"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Guía</th>
              <th className="px-3 py-2 font-medium">Ruta</th>
              <th className="px-3 py-2 font-medium">Centro de costo</th>
              <th className="px-3 py-2 font-medium">Valor</th>
              {puedeEditarOdt ? <th className="px-3 py-2 font-medium">Acciones</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtrado.map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2">{o.fecha_creacion}</td>
                <td className="px-3 py-2">{o.guia}</td>
                <td className="px-3 py-2">{o.ruta ?? o.ruta_macro ?? "—"}</td>
                <td className="px-3 py-2">{o.centro_costo_final ?? "—"}</td>
                <td className="px-3 py-2">
                  {formatoMoneda.format(o.valor_final ?? o.valor)}
                  {o.descuentoTotal > 0 ? (
                    <span
                      className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
                      title={`Descuento: -${formatoMoneda.format(o.descuentoTotal)} (${o.descuentoMotivos.join(", ")})`}
                    >
                      -{formatoMoneda.format(o.descuentoTotal)}
                    </span>
                  ) : null}
                </td>
                {puedeEditarOdt ? (
                  <td className="px-3 py-2">
                    <Link
                      href={`/odt/${encodeURIComponent(o.guia)}/corregir?volver=${encodeURIComponent(`/prefacturas/${prefacturaId}`)}`}
                      className="text-primary-ink hover:underline"
                    >
                      Editar ODT
                    </Link>
                  </td>
                ) : null}
              </tr>
            ))}
            {filtrado.length === 0 ? (
              <tr>
                <td colSpan={puedeEditarOdt ? 6 : 5} className="px-3 py-4 text-center text-muted-foreground">
                  Ninguna ODT coincide con &quot;{busqueda}&quot;.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
