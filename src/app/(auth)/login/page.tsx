"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { iniciarSesion, type EstadoLogin } from "./actions";

const estadoInicial: EstadoLogin = {};

export default function LoginPage() {
  const [estado, formAction, enviando] = useActionState(iniciarSesion, estadoInicial);
  // React limpia los campos sin controlar de un <form action={...}> una vez
  // que la Server Action termina (igual que un <form> nativo tras enviarse),
  // así que si se equivoca la contraseña también se borraba el correo ya
  // escrito. Controlando el correo con este estado evita que se pierda; la
  // contraseña se deja sin controlar a propósito, para que SÍ se borre y
  // quede lista para volver a tipearla.
  const [correo, setCorreo] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (estado.error) passwordRef.current?.focus();
  }, [estado.error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-laar-sidebar px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 h-1 w-10 rounded-full bg-laar-amarillo" />
          <CardTitle className="font-brand text-xl">LAARCOURIER</CardTitle>
          <CardDescription>Prefacturación de Transporte</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo corporativo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nombre@grupolaar.com"
                required
                autoComplete="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            {estado.error ? <p className="text-sm text-destructive">{estado.error}</p> : null}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
