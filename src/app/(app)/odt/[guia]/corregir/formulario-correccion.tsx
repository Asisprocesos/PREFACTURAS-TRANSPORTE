"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { corregirOdtAction } from "@/lib/odt/actions";
import type { Odt } from "@/lib/odt/queries";

const CAMPOS: { valor: keyof Odt; etiqueta: string }[] = [
  { valor: "placa_normalizada", etiqueta: "Placa" },
  { valor: "fecha_creacion", etiqueta: "Fecha Creación (aaaa-mm-dd)" },
  { valor: "valor_final", etiqueta: "Valor" },
  { valor: "tipo_ruta", etiqueta: "Tipo de Ruta" },
  { valor: "centro_costo_final", etiqueta: "Centro de Costo" },
  { valor: "regional_origen_texto", etiqueta: "Regional" },
];

/** Estos campos siempre se guardan en mayúsculas (ver también corregirOdtAction). */
const CAMPOS_MAYUSCULAS = new Set<keyof Odt>(["placa_normalizada", "tipo_ruta", "centro_costo_final"]);

/**
 * Valores ya cargados para sugerir en el "Valor nuevo" según el campo
 * elegido — solo para los campos que tienen un catálogo real detrás (placa,
 * tipo de ruta, centro de costo, regional). Fecha y Valor quedan afuera: son
 * campos libres sin catálogo, sugerir algo ahí no tendría sentido.
 */
export type SugerenciasCorreccion = Partial<Record<keyof Odt, string[]>>;

export function FormularioCorreccion({
  odt,
  volver,
  sugerencias,
}: {
  odt: Odt;
  volver?: string;
  sugerencias?: SugerenciasCorreccion;
}) {
  const router = useRouter();
  const [campo, setCampo] = useState<string>(CAMPOS[0]!.valor);
  const [valorNuevo, setValorNuevo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);

  const opcionesCampo = sugerencias?.[campo as keyof Odt] ?? [];

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setExito(false);
    const resultado = await corregirOdtAction(odt.id, campo, valorNuevo, motivo);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo corregir la ODT.");
      return;
    }
    setExito(true);
    setValorNuevo("");
    setMotivo("");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="campo">Campo a corregir</Label>
          <select
            id="campo"
            value={campo}
            onChange={(e) => setCampo(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {CAMPOS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="valorNuevo">Valor nuevo</Label>
          <Input
            id="valorNuevo"
            value={valorNuevo}
            onChange={(e) =>
              setValorNuevo(
                CAMPOS_MAYUSCULAS.has(campo as keyof Odt) ? e.target.value.toUpperCase() : e.target.value,
              )
            }
            list={opcionesCampo.length > 0 ? "sugerenciasValorNuevo" : undefined}
            autoComplete="off"
            required
          />
          {opcionesCampo.length > 0 ? (
            <datalist id="sugerenciasValorNuevo">
              {opcionesCampo.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="motivo">Motivo (obligatorio)</Label>
        <textarea
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          required
          rows={2}
          className="w-full rounded-md border border-input bg-background p-2 text-sm"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {exito ? (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm text-primary-ink">
            Corrección aplicada. Si la prefactura ya tenía un PDF generado, quedó marcada para regenerar —
            vuelve a darle &quot;Generar PDF&quot; para que el documento refleje el cambio.
          </p>
          {volver ? (
            <Button asChild size="sm" variant="outline">
              <Link href={volver}>Volver a la prefactura</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" disabled={cargando}>
        {cargando ? "Guardando..." : "Guardar corrección"}
      </Button>
    </form>
  );
}
