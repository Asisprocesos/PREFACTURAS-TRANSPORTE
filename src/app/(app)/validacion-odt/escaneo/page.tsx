import { Button } from "@/components/ui/button";
import { BotonVolver } from "@/components/ui/boton-volver";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth/roles";
import { iniciarSesionEscaneoAction } from "@/lib/escaneo/actions";
import { listarSesionesEscaneo } from "@/lib/escaneo/queries";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";

import { FiltrosSesionesEscaneo } from "./filtros-sesiones";
import { TablaSesionesEscaneo } from "./tabla-sesiones";

const TAMANO_PAGINA = 20;

export default async function EscaneoPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; periodo?: string; placa?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);

  const [periodos, { filas, total }] = await Promise.all([
    listarPeriodosParaSelect(),
    listarSesionesEscaneo({
      pagina,
      tamanoPagina: TAMANO_PAGINA,
      periodoId: params.periodo,
      placa: params.placa,
    }),
  ]);

  return (
    <div className="space-y-6">
      <BotonVolver fallbackHref="/validacion-odt" />
      <h1 className="titulo-marca text-2xl">Escaneo de ODT físicas</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">Iniciar sesión de escaneo</CardTitle>
          <CardDescription>
            Con lector de código de barras USB (escribe y Enter) o pegando una lista de guías. Cada lectura se
            guarda al instante — no hace falta ningún paso extra para no perderla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={iniciarSesionEscaneoAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="periodoId">Período</Label>
              <select
                id="periodoId"
                name="periodoId"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Elige un período</option>
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="placa">Placa (opcional)</Label>
              <Input id="placa" name="placa" placeholder="Déjalo vacío para escanear todo el período" />
            </div>
            <Button type="submit">Iniciar sesión</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Repositorio de sesiones</h2>
          <p className="text-sm text-muted-foreground">
            Sesiones ya escaneadas (en curso o finalizadas), para revisar el resultado sin volver a escanear.
            Búscalas por período y placa.
          </p>
        </div>
        <FiltrosSesionesEscaneo periodos={periodos} />
        <TablaSesionesEscaneo filas={filas} total={total} pagina={pagina} tamanoPagina={TAMANO_PAGINA} />
      </div>
    </div>
  );
}
