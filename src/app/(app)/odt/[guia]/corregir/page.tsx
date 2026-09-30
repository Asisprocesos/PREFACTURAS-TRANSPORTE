import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { listarDescuentosOdt } from "@/lib/descuentos/queries";
import { listarCorreccionesOdt, obtenerOdtPorGuia } from "@/lib/odt/queries";

import { FormularioCorreccion } from "./formulario-correccion";
import { FormularioDescuento } from "./formulario-descuento";

export default async function CorregirOdtPage({
  params,
  searchParams,
}: {
  params: Promise<{ guia: string }>;
  searchParams: Promise<{ volver?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const { guia } = await params;
  const { volver } = await searchParams;

  const odt = await obtenerOdtPorGuia(decodeURIComponent(guia));
  if (!odt) notFound();

  const correcciones = await listarCorreccionesOdt(odt.id);
  const descuentos = await listarDescuentosOdt(odt.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BotonVolver fallbackHref={volver ?? "/validacion-odt"} />
      <div>
        <h1 className="titulo-marca text-2xl">Corregir ODT {odt.guia}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Placa {odt.placa_normalizada ?? "—"} · Fecha creación {odt.fecha_creacion} · Valor{" "}
          {odt.valor_final ?? odt.valor}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Corregir un campo</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioCorreccion odt={odt} volver={volver} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Descuentos aplicados</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioDescuento odtId={odt.id} descuentos={descuentos} />
        </CardContent>
      </Card>

      {correcciones.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial de correcciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {correcciones.map((c) => (
                <li key={c.id} className="border-b pb-2 last:border-0">
                  <span className="font-medium">{c.campo}</span>: &quot;{c.valor_anterior}&quot; → &quot;
                  {c.valor_nuevo}&quot;
                  <p className="text-xs text-muted-foreground">
                    {c.motivo} · {new Date(c.fecha).toLocaleString("es-EC")}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
