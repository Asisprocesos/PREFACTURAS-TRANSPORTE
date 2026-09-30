"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

import { establecerClave, type EstadoActivarCuenta } from "./actions";

const estadoInicial: EstadoActivarCuenta = {};

/**
 * Supabase no soporta PKCE en invitaciones: el enlace del correo entrega la
 * sesión como fragmento de URL (#access_token=...&refresh_token=...), que
 * solo el navegador puede leer (nunca llega al servidor). Por eso esta
 * pantalla arranca como cliente: toma esos tokens del hash y los fija con
 * el cliente de navegador de Supabase (@supabase/ssr los guarda en cookies,
 * legibles luego por el servidor) antes de mostrar el formulario.
 */
export default function ActivarCuentaPage() {
  const [estado, formAction, enviando] = useActionState(establecerClave, estadoInicial);
  const [listo, setListo] = useState(false);
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setListo(true);
      return;
    }

    const supabase = createClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        setErrorEnlace(
          "El enlace de invitación expiró o ya se usó. Pide al administrador que te reenvíe la invitación.",
        );
      }
      window.history.replaceState(null, "", window.location.pathname);
      setListo(true);
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-laar-sidebar px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 h-1 w-10 rounded-full bg-laar-amarillo" />
          <CardTitle className="font-brand text-xl">LAARCOURIER</CardTitle>
          <CardDescription>Define tu contraseña para activar tu cuenta</CardDescription>
        </CardHeader>
        <CardContent>
          {!listo ? (
            <p className="text-sm text-muted-foreground">Verificando enlace...</p>
          ) : errorEnlace ? (
            <p className="text-sm text-destructive">{errorEnlace}</p>
          ) : (
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar">Confirmar contraseña</Label>
                <Input
                  id="confirmar"
                  name="confirmar"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {estado.error ? <p className="text-sm text-destructive">{estado.error}</p> : null}
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? "Guardando..." : "Activar cuenta"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
