"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarAjustesCorreoPruebaAction } from "@/lib/config/correo-prueba-actions";
import type { AjustesCorreoPrueba } from "@/lib/config/correo-prueba";

export function CorreoPruebaForm({ ajustes }: { ajustes: AjustesCorreoPrueba }) {
  const [modoPrueba, setModoPrueba] = useState(ajustes.modoPrueba);
  const [destinatarioPrueba, setDestinatarioPrueba] = useState(ajustes.destinatarioPrueba);
  const [destinatarioFallback, setDestinatarioFallback] = useState(ajustes.destinatarioFallback);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  function cambiarModoPrueba(valor: boolean) {
    // Desactivarlo significa que los correos ya no se redirigen: los
    // transportistas empiezan a recibir correos reales. Confirmación aparte
    // de "Guardar" porque es el único cambio de esta pantalla con ese riesgo.
    if (!valor) {
      const confirmado = confirm(
        "¿Desactivar el modo prueba? Desde ese momento los correos se enviarán de verdad a los transportistas, no al destinatario de prueba.",
      );
      if (!confirmado) return;
    }
    setModoPrueba(valor);
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    const resultado = await actualizarAjustesCorreoPruebaAction({
      modoPrueba,
      destinatarioPrueba,
      destinatarioFallback,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setMensaje({ texto: resultado.error ?? "No se pudo guardar.", ok: false });
      return;
    }
    setMensaje({ texto: "Guardado. Se aplica en el próximo correo que se envíe.", ok: true });
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="modoPrueba">Modo prueba</Label>
        <select
          id="modoPrueba"
          value={modoPrueba ? "activado" : "desactivado"}
          onChange={(e) => cambiarModoPrueba(e.target.value === "activado")}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
        >
          <option value="activado">Activado — todo correo se redirige al destinatario de prueba</option>
          <option value="desactivado">Desactivado — los correos van de verdad a los transportistas</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="destinatarioPrueba">Destinatario(s) de prueba</Label>
        <Input
          id="destinatarioPrueba"
          value={destinatarioPrueba}
          onChange={(e) => setDestinatarioPrueba(e.target.value)}
          placeholder="persona1@grupolaar.com, persona2@grupolaar.com"
        />
        <p className="text-xs text-muted-foreground">
          Varios correos separados por coma. Obligatorio mientras el modo prueba esté activado.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="destinatarioFallback">Destinatario de respaldo (sin correo registrado)</Label>
        <Input
          id="destinatarioFallback"
          value={destinatarioFallback}
          onChange={(e) => setDestinatarioFallback(e.target.value)}
          placeholder="respaldo@grupolaar.com"
        />
        <p className="text-xs text-muted-foreground">
          Recibe el ZIP consolidado de las prefacturas sin correo registrado (ni en el vehículo ni en el
          transportista) al usar &quot;Enviar seleccionados&quot;. También admite varios correos separados por
          coma.
        </p>
      </div>

      {mensaje ? (
        <p className={mensaje.ok ? "text-sm text-primary-ink" : "text-sm text-destructive"}>
          {mensaje.texto}
        </p>
      ) : null}

      <Button type="button" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}
