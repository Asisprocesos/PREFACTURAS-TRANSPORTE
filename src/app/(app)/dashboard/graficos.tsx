"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COLOR_EJE, COLOR_GRID, COLOR_TEXTO_SECUNDARIO, PALETA_ESTADO } from "@/lib/dashboard/paleta";

const formatoMoneda = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const formatoMonedaCompleta = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

interface PuntoBarra {
  nombre: string;
  monto: number;
}

/**
 * Barras horizontales de una sola serie (magnitud por categoría): un único
 * color fijo, nunca un color por barra, por eso no hace falta leyenda
 * (`references/color-formula.md`, gráfico de magnitud sin identidad).
 */
export function GraficoBarrasMonto({
  titulo,
  descripcion,
  datos,
  color,
}: {
  titulo: string;
  descripcion: string;
  datos: PuntoBarra[];
  color: string;
}) {
  const altura = Math.max(160, datos.length * 36 + 40);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        {datos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin datos para este período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={altura}>
            <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={COLOR_GRID} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => formatoMoneda.format(v)}
                stroke={COLOR_EJE}
                tick={{ fill: COLOR_TEXTO_SECUNDARIO, fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="nombre"
                width={140}
                stroke={COLOR_EJE}
                tick={{ fill: COLOR_TEXTO_SECUNDARIO, fontSize: 12 }}
              />
              <Tooltip
                formatter={(valor: number) => formatoMonedaCompleta.format(valor)}
                cursor={{ fill: "rgba(11,11,11,0.04)" }}
                contentStyle={{ fontSize: 13 }}
              />
              <Bar dataKey="monto" fill={color} radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

interface SegmentoEnvio {
  etiqueta: string;
  cantidad: number;
  color: string;
  icono: string;
}

/**
 * Avance de envío: no es una comparación de identidades sino de ESTADO, por
 * eso usa la paleta de estado (reservada, nunca color solo: siempre
 * icono + etiqueta junto al color, ver `references/palette.md`).
 */
export function GraficoAvanceEnvio({
  pendientes,
  enviadas,
  errores,
}: {
  pendientes: number;
  enviadas: number;
  errores: number;
}) {
  const total = pendientes + enviadas + errores;
  const segmentos: SegmentoEnvio[] = [
    { etiqueta: "Enviadas", cantidad: enviadas, color: PALETA_ESTADO.bueno, icono: "✅" },
    { etiqueta: "Pendientes de envío", cantidad: pendientes, color: PALETA_ESTADO.advertencia, icono: "⏳" },
    { etiqueta: "Con error de envío", cantidad: errores, color: PALETA_ESTADO.critico, icono: "⚠️" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avance de envío</CardTitle>
        <CardDescription>Prefacturas del período según su estado de envío por correo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin prefacturas en este período.</p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {segmentos.map((s) =>
                s.cantidad > 0 ? (
                  <div
                    key={s.etiqueta}
                    style={{ width: `${(s.cantidad / total) * 100}%`, backgroundColor: s.color }}
                    title={`${s.etiqueta}: ${s.cantidad}`}
                  />
                ) : null,
              )}
            </div>
            <ul className="space-y-2 text-sm">
              {segmentos.map((s) => (
                <li key={s.etiqueta} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true">{s.icono}</span>
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden="true"
                    />
                    {s.etiqueta}
                  </span>
                  <span className="font-medium">
                    {s.cantidad} · {total > 0 ? Math.round((s.cantidad / total) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
