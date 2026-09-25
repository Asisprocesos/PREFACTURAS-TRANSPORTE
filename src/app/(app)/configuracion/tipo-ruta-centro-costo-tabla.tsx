"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  actualizarTipoRutaCentroCostoAction,
  crearTipoRutaCentroCostoAction,
} from "@/lib/catalogos/tipo-ruta-centro-costo/actions";
import type { TipoRutaCentroCosto } from "@/lib/catalogos/tipo-ruta-centro-costo/queries";

interface FormValues {
  tipoRuta: string;
  centroCosto: string;
  requiereRevision: boolean;
  activo: boolean;
}

const VACIO: FormValues = { tipoRuta: "", centroCosto: "", requiereRevision: false, activo: true };

export function TipoRutaCentroCostoTabla({
  filas,
  tipoRutaInicial,
}: {
  filas: TipoRutaCentroCosto[];
  /** Llegó desde "Corregir" en una advertencia del importador: abre esa fila para editarla (o precarga el alta si todavía no existe). */
  tipoRutaInicial?: string;
}) {
  const router = useRouter();
  const [nuevaFila, setNuevaFila] = useState<FormValues>(VACIO);
  const [filaEnEdicion, setFilaEnEdicion] = useState<string | null>(null);
  const [valoresEdicion, setValoresEdicion] = useState<FormValues>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!tipoRutaInicial) return;
    const existente = filas.find((f) => f.tipo_ruta.toUpperCase() === tipoRutaInicial.toUpperCase());
    if (existente) {
      iniciarEdicion(existente);
    } else {
      setNuevaFila((v) => ({ ...v, tipoRuta: tipoRutaInicial.toUpperCase() }));
    }
    // Solo al llegar con el query param, no en cada cambio de `filas`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoRutaInicial]);

  function iniciarEdicion(fila: TipoRutaCentroCosto) {
    setFilaEnEdicion(fila.id);
    setValoresEdicion({
      tipoRuta: fila.tipo_ruta,
      centroCosto: fila.centro_costo ?? "",
      requiereRevision: fila.requiere_revision,
      activo: fila.activo,
    });
    setMensaje(null);
  }

  async function guardarEdicion(id: string) {
    setGuardando(true);
    setMensaje(null);
    const resultado = await actualizarTipoRutaCentroCostoAction(id, valoresEdicion);
    setGuardando(false);
    if (!resultado.ok) {
      setMensaje({ texto: resultado.error ?? "No se pudo guardar.", ok: false });
      return;
    }
    setFilaEnEdicion(null);
    router.refresh();
  }

  async function agregar() {
    if (!nuevaFila.tipoRuta.trim()) return;
    setGuardando(true);
    setMensaje(null);
    const resultado = await crearTipoRutaCentroCostoAction(nuevaFila);
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
              <th className="px-4 py-3 font-medium">Tipo de Ruta</th>
              <th className="px-4 py-3 font-medium">Centro de Costo</th>
              <th className="px-4 py-3 font-medium">Requiere revisión</th>
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
                          value={valoresEdicion.tipoRuta}
                          onChange={(e) =>
                            setValoresEdicion((v) => ({ ...v, tipoRuta: e.target.value.toUpperCase() }))
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={valoresEdicion.centroCosto}
                          onChange={(e) =>
                            setValoresEdicion((v) => ({ ...v, centroCosto: e.target.value.toUpperCase() }))
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={valoresEdicion.requiereRevision}
                          onChange={(e) =>
                            setValoresEdicion((v) => ({ ...v, requiereRevision: e.target.checked }))
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
                      <td className="px-4 py-3 font-medium">{f.tipo_ruta}</td>
                      <td className="px-4 py-3">{f.centro_costo || "—"}</td>
                      <td className="px-4 py-3">{f.requiere_revision ? "Sí" : "No"}</td>
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
                  placeholder="Tipo de Ruta"
                  value={nuevaFila.tipoRuta}
                  onChange={(e) => setNuevaFila((v) => ({ ...v, tipoRuta: e.target.value.toUpperCase() }))}
                />
              </td>
              <td className="px-4 py-2">
                <Input
                  placeholder="Centro de Costo"
                  value={nuevaFila.centroCosto}
                  onChange={(e) => setNuevaFila((v) => ({ ...v, centroCosto: e.target.value.toUpperCase() }))}
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={nuevaFila.requiereRevision}
                  onChange={(e) => setNuevaFila((v) => ({ ...v, requiereRevision: e.target.checked }))}
                />
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">Activo</td>
              <td className="px-4 py-2">
                <Button size="sm" disabled={guardando || !nuevaFila.tipoRuta.trim()} onClick={agregar}>
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
