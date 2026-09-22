"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enviarCorreoIndividualAction } from "@/lib/correo/actions";

import { PdfPreview } from "./pdf-preview";

export function EnviarCorreoForm({
  prefacturaId,
  correoPrincipal,
  correosAdicionales,
  asuntoInicial,
  cuerpoInicial,
}: {
  prefacturaId: string;
  correoPrincipal: string | null;
  correosAdicionales: string[];
  asuntoInicial: string;
  cuerpoInicial: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [principal, setPrincipal] = useState(correoPrincipal ?? "");
  const [adicionales, setAdicionales] = useState<string[]>(correosAdicionales);
  const [nuevoAdicional, setNuevoAdicional] = useState("");
  const [asunto, setAsunto] = useState(asuntoInicial);
  const [cuerpo, setCuerpo] = useState(cuerpoInicial);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  function agregarAdicional() {
    if (!nuevoAdicional.trim()) return;
    setAdicionales((prev) => [...prev, nuevoAdicional.trim()]);
    setNuevoAdicional("");
  }

  async function enviar() {
    setCargando(true);
    setMensaje(null);
    try {
      const resultado = await enviarCorreoIndividualAction(prefacturaId, {
        to: principal ? [principal] : [],
        cc: adicionales,
        asunto,
        cuerpo,
      });
      setMensaje({
        texto: resultado.ok ? "Correo enviado." : (resultado.error ?? "Error"),
        ok: resultado.ok,
      });
      if (resultado.ok) router.refresh();
    } catch (error) {
      setMensaje({
        texto: error instanceof Error ? error.message : "Error inesperado enviando el correo.",
        ok: false,
      });
    } finally {
      setCargando(false);
    }
  }

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        Enviar por correo
      </Button>
    );
  }

  return (
    <div className="w-full max-w-md space-y-3 rounded-lg border bg-card p-4 text-left">
      <div className="space-y-1">
        <Label>PDF que se va a adjuntar</Label>
        <PdfPreview prefacturaId={prefacturaId} alto="h-64" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="correoPrincipal">Correo principal</Label>
        <Input
          id="correoPrincipal"
          type="email"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Correos adicionales</Label>
        {adicionales.map((a, i) => (
          <div key={i} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
            <span>{a}</span>
            <button type="button" onClick={() => setAdicionales((prev) => prev.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="correo@ejemplo.com"
            value={nuevoAdicional}
            onChange={(e) => setNuevoAdicional(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" onClick={agregarAdicional}>
            Agregar otro
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="asunto">Asunto</Label>
        <Input id="asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cuerpo">Mensaje</Label>
        <textarea
          id="cuerpo"
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-input bg-background p-2 text-sm"
        />
      </div>

      {mensaje ? (
        <p className={mensaje.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{mensaje.texto}</p>
      ) : null}

      <div className="flex gap-2">
        <Button onClick={enviar} disabled={cargando || !principal}>
          {cargando ? "Enviando..." : "Enviar"}
        </Button>
        <Button variant="ghost" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
