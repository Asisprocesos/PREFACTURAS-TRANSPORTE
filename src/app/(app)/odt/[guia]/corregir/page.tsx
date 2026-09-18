import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/roles";
import { listarCorreccionesOdt, obtenerOdtPorGuia } from "@/lib/odt/queries";

import { FormularioCorreccion } from "./formulario-correccion";

export default async function CorregirOdtPage({ params }: { params: Promise<{ guia: string }> }) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const { guia } = await params;

  const odt = await obtenerOdtPorGuia(decodeURIComponent(guia));
  if (!odt) notFound();

  const correcciones = await listarCorreccionesOdt(odt.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Corregir ODT {odt.guia}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Placa {odt.placa_normalizada ?? "—"} · Fecha creación {odt.fecha_creacion} · Valor {odt.valor}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Corregir un campo</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioCorreccion odt={odt} />
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
