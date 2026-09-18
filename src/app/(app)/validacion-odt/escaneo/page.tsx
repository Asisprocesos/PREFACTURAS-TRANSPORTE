import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth/roles";
import { iniciarSesionEscaneoAction } from "@/lib/escaneo/actions";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";

export default async function EscaneoPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const periodos = await listarPeriodosParaSelect();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="titulo-marca text-2xl">Escaneo de ODT físicas</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Iniciar sesión de escaneo</CardTitle>
          <CardDescription>
            Con lector de código de barras USB (escribe y Enter) o pegando una lista de guías.
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
    </div>
  );
}
