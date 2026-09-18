"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invitarUsuario, type EstadoAccionUsuario } from "@/lib/usuarios/actions";

const estadoInicial: EstadoAccionUsuario = {};

export function InvitarUsuarioForm() {
  const [estado, formAction, enviando] = useActionState(invitarUsuario, estadoInicial);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Invitar usuario</CardTitle>
        <CardDescription>
          Se envía un correo de invitación a la dirección @grupolaar.com. El usuario queda con rol CONSULTA
          hasta que lo promuevas en la tabla de abajo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" required placeholder="Nombre y apellido" />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" required placeholder="nombre@grupolaar.com" />
          </div>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Invitando..." : "Invitar"}
          </Button>
        </form>
        {estado.error ? <p className="mt-2 text-sm text-destructive">{estado.error}</p> : null}
        {estado.ok ? <p className="mt-2 text-sm text-primary">Invitación enviada.</p> : null}
      </CardContent>
    </Card>
  );
}
