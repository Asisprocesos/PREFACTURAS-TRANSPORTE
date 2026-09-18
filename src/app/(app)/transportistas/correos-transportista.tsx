"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agregarCorreoTransportista, eliminarCorreoTransportista } from "@/lib/transportistas/actions";
import type { ContactoCorreo } from "@/lib/transportistas/queries";

export function CorreosTransportista({
  transportistaId,
  correos,
  soloLectura,
}: {
  transportistaId: string;
  correos: ContactoCorreo[];
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState<"PRINCIPAL" | "ADICIONAL">("ADICIONAL");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const resultado = await agregarCorreoTransportista(transportistaId, { email, tipo });
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo agregar el correo.");
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function eliminar(correoId: string) {
    await eliminarCorreoTransportista(transportistaId, correoId);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {correos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin correos registrados. Sin al menos un correo no se podrá enviar la prefactura.
        </p>
      ) : (
        <ul className="space-y-2">
          {correos.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>
                {c.email}{" "}
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.tipo === "PRINCIPAL" ? "Principal" : "Adicional"}
                </span>
              </span>
              {!soloLectura ? (
                <Button variant="ghost" size="sm" onClick={() => eliminar(c.id)}>
                  Quitar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!soloLectura ? (
        <form onSubmit={agregar} className="flex flex-wrap items-end gap-2">
          <Input
            type="email"
            placeholder="correo@transportista.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="max-w-xs"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "PRINCIPAL" | "ADICIONAL")}
            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="PRINCIPAL">Principal</option>
            <option value="ADICIONAL">Adicional</option>
          </select>
          <Button type="submit" variant="outline" disabled={enviando}>
            {enviando ? "Agregando..." : "Agregar correo"}
          </Button>
        </form>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
