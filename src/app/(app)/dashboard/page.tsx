import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const INDICADORES = [
  { titulo: "Total de prefacturas", valor: "—" },
  { titulo: "Pendientes de PDF", valor: "—" },
  { titulo: "Enviadas", valor: "—" },
  { titulo: "Novedades abiertas", valor: "—" },
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Indicadores del período. Los datos reales se conectan en la fase de Dashboard y reportes (ver{" "}
          <code>docs/arquitectura.md</code>).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INDICADORES.map((ind) => (
          <Card key={ind.titulo}>
            <CardHeader className="pb-2">
              <CardDescription>{ind.titulo}</CardDescription>
              <CardTitle className="text-3xl">{ind.valor}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  );
}
