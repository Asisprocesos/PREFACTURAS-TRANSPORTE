import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";
import { listarTipoTransportista } from "@/lib/catalogos/tipo-transportista/queries";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";
import { obtenerSeguimientoTransportistas } from "@/lib/transportistas/queries";

import { FiltroPeriodo } from "./filtro-periodo";
import { TablaSeguimiento } from "./tabla-seguimiento";

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export default async function SeguimientoTransportistasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const puedeEditar = perfil.rol === "ADMIN" || perfil.rol === "OPERADOR_TRANSPORTE";

  const [periodos, tiposTransportista] = await Promise.all([
    listarPeriodosParaSelect(),
    puedeEditar ? listarTipoTransportista() : Promise.resolve([]),
  ]);
  const periodoId = params.periodo || periodos.find((p) => p.estado === "ABIERTO")?.id;
  const seguimiento = periodoId ? await obtenerSeguimientoTransportistas(periodoId) : null;
  const tiposActivos = tiposTransportista.filter((t) => t.activo);

  return (
    <div className="space-y-6">
      <BotonVolver fallbackHref="/transportistas" />
      <div>
        <h1 className="titulo-marca text-2xl">Seguimiento de transportistas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cuántas prefacturas y cuánto se factura por tipo de transportista (FIJO, BACK u otro tipo del
          catálogo) en un período, con el detalle por transportista. Los transportistas sin tipo asignado se
          agrupan aparte, para detectar a quién le falta clasificar.
        </p>
      </div>

      <FiltroPeriodo periodos={periodos} />

      {!periodoId ? (
        <p className="text-sm text-muted-foreground">Elige un período para ver el seguimiento.</p>
      ) : !seguimiento || seguimiento.porTransportista.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay prefacturas en ese período todavía.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {seguimiento.porTipo.map((r) => (
              <Card key={r.tipo ?? "sin-tipo"}>
                <CardHeader>
                  <CardTitle className="text-base">{r.tipo ?? "Sin tipo asignado"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-2xl font-semibold">{r.cantidadPrefacturas}</p>
                  <p className="text-xs text-muted-foreground">
                    prefacturas · {r.cantidadTransportistas} transportista
                    {r.cantidadTransportistas === 1 ? "" : "s"}
                  </p>
                  <p className="text-sm font-medium text-primary-ink">
                    {formatoMoneda.format(r.totalFacturado)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <TablaSeguimiento
            filas={seguimiento.porTransportista}
            tiposTransportista={tiposActivos}
            puedeEditar={puedeEditar}
          />
        </>
      )}
    </div>
  );
}
