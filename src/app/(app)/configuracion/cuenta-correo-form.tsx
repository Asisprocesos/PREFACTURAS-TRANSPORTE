"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarCuentaCorreoAction } from "@/lib/config/cuenta-correo-actions";
import type { EstadoEnvioDiario } from "@/lib/config/cuenta-correo";
import { cn } from "@/lib/utils";

const ETIQUETA_CUENTA = { PRINCIPAL: "Principal", RESPALDO: "Respaldo" } as const;

export function CuentaCorreoForm({ estado }: { estado: EstadoEnvioDiario }) {
  const [cuentaActiva, setCuentaActiva] = useState(estado.cuentaActiva);
  const [limiteDiario, setLimiteDiario] = useState(String(estado.limiteDiario));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  async function guardar() {
    const limite = Number(limiteDiario);
    if (!Number.isFinite(limite) || limite <= 0) {
      setMensaje({ texto: "El límite diario debe ser un número mayor a 0.", ok: false });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    const resultado = await actualizarCuentaCorreoAction({ cuentaActiva, limiteDiario: limite });
    setGuardando(false);
    if (!resultado.ok) {
      setMensaje({ texto: resultado.error ?? "No se pudo guardar.", ok: false });
      return;
    }
    setMensaje({
      texto:
        cuentaActiva !== estado.cuentaActiva
          ? `Guardado. Los próximos correos se envían con la cuenta ${ETIQUETA_CUENTA[cuentaActiva]}.`
          : "Guardado.",
      ok: true,
    });
  }

  const porcentaje = Math.min(100, Math.round((estado.enviadosHoy / estado.limiteDiario) * 100));
  const colorBarra = porcentaje >= 100 ? "bg-destructive" : porcentaje >= 80 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-2 rounded-md border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span>
            Enviados hoy con la cuenta <strong>{ETIQUETA_CUENTA[estado.cuentaActiva]}</strong>
          </span>
          <span className="font-medium">
            {estado.enviadosHoy} / {estado.limiteDiario}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full transition-all", colorBarra)} style={{ width: `${porcentaje}%` }} />
        </div>
        {porcentaje >= 100 ? (
          <p className="text-xs text-destructive">
            Se alcanzó el límite diario de la cuenta {ETIQUETA_CUENTA[estado.cuentaActiva]}. Cambia a la
            cuenta de Respaldo abajo para seguir enviando hoy mismo — los correos pendientes se reintentan
            solos, no hay que reenviarlos a mano.
          </p>
        ) : porcentaje >= 80 ? (
          <p className="text-xs text-amber-600">
            Te estás acercando al límite diario. Si lo alcanzas, cambia a la cuenta de Respaldo abajo.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cuentaActiva">Cuenta de envío activa</Label>
        <select
          id="cuentaActiva"
          value={cuentaActiva}
          onChange={(e) => setCuentaActiva(e.target.value as "PRINCIPAL" | "RESPALDO")}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
        >
          <option value="PRINCIPAL">Principal</option>
          <option value="RESPALDO">Respaldo</option>
        </select>
        <p className="text-xs text-muted-foreground">
          La cuenta de Respaldo necesita sus propias variables en Vercel (<code>SMTP_HOST_RESPALDO</code>,{" "}
          <code>SMTP_USER_RESPALDO</code>, <code>SMTP_PASSWORD_RESPALDO</code>, etc. — mismo formato que las
          de la cuenta Principal).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="limiteDiario">Límite diario de envíos</Label>
        <Input
          id="limiteDiario"
          type="number"
          min={1}
          value={limiteDiario}
          onChange={(e) => setLimiteDiario(e.target.value)}
          className="max-w-[160px]"
        />
        <p className="text-xs text-muted-foreground">
          500 para una cuenta Gmail personal, 2000 para Google Workspace. Solo gobierna el aviso en pantalla —
          Gmail sigue aplicando su propio límite aunque acá se ponga otro número.
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
