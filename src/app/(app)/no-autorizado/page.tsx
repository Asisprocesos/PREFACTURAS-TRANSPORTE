import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NoAutorizadoPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>No tienes acceso a esta pantalla</CardTitle>
          <CardDescription>
            Tu rol actual no incluye este módulo. Si crees que deberías tener acceso, pide a un
            administrador que revise tu rol en Usuarios.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
