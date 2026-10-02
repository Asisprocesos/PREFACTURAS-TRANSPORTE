"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  actualizarTipoTransportistaAction,
  crearTipoTransportistaAction,
} from "@/lib/catalogos/tipo-transportista/actions";
import type { TipoTransportista } from "@/lib/catalogos/tipo-transportista/queries";

interface FormValues {
  nombre: string;
  activo: boolean;
}

const VACIO: FormValues = { nombre: "", activo: true };

export function TipoTransportistaTabla({ filas }: { filas: TipoTransportista[] }) {
  const router = useRouter();
  const [nuevaFila, setNuevaFila] = useState<FormValues>(VACIO);
  const [filaEnEdicion, setFilaEnEdicion] = useState<string | null>(null);
  const [valoresEdicion, setValoresEdicion] = useState<FormValues>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  function iniciarEdicion(fila: TipoTransportista) {
    setFilaEnEdicion(fila.id);
    setValoresEdicion({ nombre: fila.nombre, activo: fila.activo });
    setMensaje(null);
  }

  async function guardarEdicion(id: string) {
    setGuardando(true);
    setMensaje(null);
    const resultado = await actualizarTipoTransportistaAction(id, valoresEdicion);
    setGuardando(false);
    if (!resultado.ok) {
      setMensaje({ texto: resultado.error ?? "No se pudo guardar.", ok: false });
      return;
    }
    setFilaEnEdicion(null);
    router.refresh();
  }

  async function agregar() {
    if (!nuevaFila.nombre.trim()) return;
    setGuardando(true);
    setMensaje(null);
    const resultado = await crearTipoTransportistaAction(nuevaFila);
    setGuardando(false);
    if (!resultado.ok) {
      setMensaje({ texto: resultado.error ?? "No se pudo agregar.", ok: false });
      return;
    }
    setNuevaFila(VACIO);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {mensaje ? (
        <p className={mensaje.ok ? "text-sm text-primary-ink" : "text-sm text-destructive"}>
          {mensaje.texto}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tipo de Transportista</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.map((f) => {
              const enEdicion = filaEnEdicion === f.id;
              return (
                <tr key={f.id}>
                  {enEdicion ? (
                    <>
                      <td className="px-4 py-2">
                        <Input
                          value={valoresEdicion.nombre}
                          onChange={(e) =>
                            setValoresEdicion((v) => ({ ...v, nombre: e.target.value.toUpperCase() }))
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={valoresEdicion.activo ? "activo" : "inactivo"}
                          onChange={(e) =>
                            setValoresEdicion((v) => ({ ...v, activo: e.target.value === "activo" }))
                          }
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="activo">Activo</option>
                          <option value="inactivo">Inactivo</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button size="sm" disabled={guardando} onClick={() => guardarEdicion(f.id)}>
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={guardando}
                            onClick={() => setFilaEnEdicion(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium">{f.nombre}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            f.activo
                              ? "rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {f.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" onClick={() => iniciarEdicion(f)}>
                          Editar
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            <tr className="bg-muted/20">
              <td className="px-4 py-2">
                <Input
                  placeholder="Tipo de Transportista (ej. FIJO, BACK)"
                  value={nuevaFila.nombre}
                  onChange={(e) => setNuevaFila((v) => ({ ...v, nombre: e.target.value.toUpperCase() }))}
                />
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">Activo</td>
              <td className="px-4 py-2">
                <Button size="sm" disabled={guardando || !nuevaFila.nombre.trim()} onClick={agregar}>
                  Agregar
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
