"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cambiarTipoTransportistaAction } from "@/lib/transportistas/actions";
import type { FilaSeguimientoTransportista } from "@/lib/transportistas/queries";

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

/** Valor del <select> de filtro para agrupar los transportistas sin tipo asignado (no puede ser "" porque esa opción significa "todos"). */
const SIN_TIPO = "__SIN_TIPO__";

export function TablaSeguimiento({
  filas,
  tiposTransportista,
  puedeEditar,
}: {
  filas: FilaSeguimientoTransportista[];
  tiposTransportista: { id: string; nombre: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filaEnEdicion, setFilaEnEdicion] = useState<string | null>(null);
  const [valorEdicion, setValorEdicion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Las opciones del filtro salen de los datos (no solo del catálogo activo)
  // para no esconder un tipo legado o desactivado que igual tiene
  // transportistas facturando en este período.
  const tiposPresentes = [
    ...new Set(filas.map((f) => f.tipoTransportista).filter((t): t is string => !!t)),
  ].sort((a, b) => a.localeCompare(b));
  const hayTransportistasSinTipo = filas.some((f) => !f.tipoTransportista);

  const termino = busqueda.trim().toLowerCase();
  const filasFiltradas = filas.filter((f) => {
    if (termino && !f.nombre.toLowerCase().includes(termino)) return false;
    if (filtroTipo === SIN_TIPO && f.tipoTransportista) return false;
    if (filtroTipo && filtroTipo !== SIN_TIPO && f.tipoTransportista?.toUpperCase() !== filtroTipo) {
      return false;
    }
    return true;
  });

  function iniciarEdicion(fila: FilaSeguimientoTransportista) {
    setFilaEnEdicion(fila.transportistaId);
    setValorEdicion(fila.tipoTransportista ?? "");
    setError(null);
  }

  async function guardar(transportistaId: string) {
    setGuardando(true);
    setError(null);
    const resultado = await cambiarTipoTransportistaAction(transportistaId, valorEdicion);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo guardar.");
      return;
    }
    setFilaEnEdicion(null);
    router.refresh();
  }

  // El valor guardado puede ser legado (texto libre de antes de este
  // catálogo) y no calzar con ninguna fila activa — se agrega igual como
  // opción para no perderlo/cambiarlo en silencio.
  function opcionesPara(fila: FilaSeguimientoTransportista) {
    const legado = fila.tipoTransportista;
    if (legado && !tiposTransportista.some((t) => t.nombre.toUpperCase() === legado.toUpperCase())) {
      return [...tiposTransportista, { id: legado, nombre: legado }];
    }
    return tiposTransportista;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar transportista..."
          className="max-w-sm"
        />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos los tipos</option>
          {tiposPresentes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          {hayTransportistasSinTipo ? <option value={SIN_TIPO}>Sin tipo asignado</option> : null}
        </select>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Transportista</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Prefacturas</th>
              <th className="px-4 py-3 font-medium">Total facturado</th>
              {puedeEditar ? <th className="px-4 py-3 font-medium">Acciones</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={puedeEditar ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">
                  No se encontraron transportistas.
                </td>
              </tr>
            ) : (
              filasFiltradas.map((f) => {
                const enEdicion = filaEnEdicion === f.transportistaId;
                return (
                  <tr key={f.transportistaId}>
                    <td className="px-4 py-3 font-medium">{f.nombre}</td>
                    <td className="px-4 py-3">
                      {enEdicion ? (
                        <select
                          autoFocus
                          value={valorEdicion}
                          onChange={(e) => setValorEdicion(e.target.value)}
                          disabled={guardando}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Sin tipo asignado</option>
                          {opcionesPara(f).map((t) => (
                            <option key={t.id} value={t.nombre}>
                              {t.nombre}
                            </option>
                          ))}
                        </select>
                      ) : f.tipoTransportista ? (
                        f.tipoTransportista
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                          Sin tipo asignado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{f.cantidadPrefacturas}</td>
                    <td className="px-4 py-3">{formatoMoneda.format(f.totalFacturado)}</td>
                    {puedeEditar ? (
                      <td className="px-4 py-3">
                        {enEdicion ? (
                          <div className="flex gap-2">
                            <Button size="sm" disabled={guardando} onClick={() => guardar(f.transportistaId)}>
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
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => iniciarEdicion(f)}>
                            Cambiar tipo
                          </Button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
