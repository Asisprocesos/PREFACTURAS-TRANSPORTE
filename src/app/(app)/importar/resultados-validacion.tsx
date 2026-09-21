"use client";

import { Fragment, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { establecerDecisionFilaAction } from "@/lib/importador/confirmar-action";
import { corregirFilaImportacionAction, type CorreccionFila } from "@/lib/importador/correccion-action";
import { listarFilasImportacionAction } from "@/lib/importador/lectura-actions";
import type { ImportacionFila, PestanaFilas } from "@/lib/importador/queries";
import type { ResumenValidacion } from "@/lib/importador/validar-action";
import { cn } from "@/lib/utils";

const TAMANO_PAGINA = 25;

const PESTANAS: { id: PestanaFilas; etiqueta: (r: ResumenValidacion) => string }[] = [
  { id: "errores", etiqueta: (r) => `Errores (${r.filasConError})` },
  { id: "advertencias", etiqueta: (r) => `Advertencias (${r.filasAdvertencias})` },
  { id: "validas", etiqueta: (r) => `Válidas (${r.filasValidas})` },
];

const ETIQUETA_DECISION: Record<string, string> = {
  INSERTAR: "Se insertará",
  OMITIR: "Omitida",
  CORREGIR: "Por corregir",
};

export function ResultadosValidacion({
  importacionId,
  resumen,
  onResumenActualizado,
  soloLectura = false,
}: {
  importacionId: string;
  resumen: ResumenValidacion;
  onResumenActualizado?: (resumen: ResumenValidacion) => void;
  /** true una vez que la importación ya se confirmó: las ODT reales ya se
   * insertaron, así que corregir el staging aquí no tendría ningún efecto. */
  soloLectura?: boolean;
}) {
  const [pestana, setPestana] = useState<PestanaFilas>("errores");
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState<ImportacionFila[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [filaEnEdicion, setFilaEnEdicion] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    listarFilasImportacionAction({ importacionId, pestana, pagina, tamanoPagina: TAMANO_PAGINA })
      .then((r) => {
        if (cancelado) return;
        setFilas(r.filas);
        setTotal(r.total);
      })
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [importacionId, pestana, pagina, recarga]);

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  function refrescar(nuevoResumen?: ResumenValidacion) {
    if (nuevoResumen) onResumenActualizado?.(nuevoResumen);
    setRecarga((r) => r + 1);
  }

  async function omitir(filaId: string) {
    const r = await establecerDecisionFilaAction(filaId, "OMITIR");
    if (r.ok) refrescar(r.resumen);
  }

  async function insertar(filaId: string) {
    const r = await establecerDecisionFilaAction(filaId, "INSERTAR");
    if (r.ok) refrescar(r.resumen);
  }

  async function corregir(filaId: string, correccion: CorreccionFila) {
    const r = await corregirFilaImportacionAction(filaId, correccion);
    if (r.ok) {
      setFilaEnEdicion(null);
      refrescar(r.resumen);
    }
    return r;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Resumen etiqueta="Leídas" valor={resumen.filasLeidas} />
        <Resumen etiqueta="Válidas" valor={resumen.filasValidas} tono="ok" />
        <Resumen etiqueta="Con error" valor={resumen.filasConError} tono="error" />
        <Resumen etiqueta="Con advertencia" valor={resumen.filasAdvertencias} tono="advertencia" />
        <Resumen etiqueta="Excluidas (no Entregado)" valor={resumen.filasExcluidas} />
      </div>

      <div className="flex gap-2 border-b">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPestana(p.id);
              setPagina(1);
              setFilaEnEdicion(null);
            }}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              pestana === p.id ? "border-primary text-primary" : "border-transparent text-muted-foreground",
            )}
          >
            {p.etiqueta(resumen)}
          </button>
        ))}
      </div>

      {soloLectura ? (
        <p className="text-xs text-muted-foreground">
          Esta importación ya se confirmó: las ODT reales ya se insertaron, así que este staging queda solo
          como referencia (de solo lectura). Para corregir un dato ya importado, usa la corrección de ODT
          desde Control por placa o el detalle de la ODT.
        </p>
      ) : pestana === "errores" ? (
        <p className="text-xs text-muted-foreground">
          Una fila con error no se inserta mientras tenga errores. &quot;Corregir&quot; revalida con las
          mismas reglas de la validación normal, así que solo pasa a insertarse cuando ya no queda ningún
          error (por ejemplo, forzar la inserción de una guía duplicada rompería toda la confirmación del
          lote, por eso no está disponible aquí).
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Fila</th>
              <th className="px-3 py-2 font-medium">Guía</th>
              <th className="px-3 py-2 font-medium">Placa</th>
              <th className="px-3 py-2 font-medium">Mensajes</th>
              {!soloLectura && pestana !== "validas" ? (
                <th className="px-3 py-2 font-medium">Acciones</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y">
            {cargando ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Sin filas en esta pestaña.
                </td>
              </tr>
            ) : (
              filas.map((f) => {
                const norm = f.datos_normalizados as Record<string, unknown> | null;
                const errores = f.errores as string[];
                const advertencias = f.advertencias as string[];
                const mensajes = [...errores, ...advertencias];
                const tieneErrores = errores.length > 0;
                const enEdicion = filaEnEdicion === f.id;

                return (
                  <Fragment key={f.id}>
                    <tr>
                      <td className="px-3 py-2">{f.numero_fila}</td>
                      <td className="px-3 py-2">{(norm?.guia as string) ?? "—"}</td>
                      <td className="px-3 py-2">{(norm?.placaNormalizada as string) ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        <div>{mensajes.join(" · ") || "—"}</div>
                        {f.decision ? (
                          <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                            {ETIQUETA_DECISION[f.decision] ?? f.decision}
                          </span>
                        ) : null}
                      </td>
                      {!soloLectura && pestana !== "validas" ? (
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {!tieneErrores ? (
                              <Button
                                size="sm"
                                variant={f.decision === "INSERTAR" ? "default" : "outline"}
                                onClick={() => insertar(f.id)}
                              >
                                Insertar
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant={f.decision === "OMITIR" ? "default" : "outline"}
                              onClick={() => omitir(f.id)}
                            >
                              Omitir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setFilaEnEdicion(enEdicion ? null : f.id)}
                            >
                              {enEdicion ? "Cancelar" : "Corregir"}
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                    {enEdicion ? (
                      <tr>
                        <td colSpan={5} className="bg-muted/30 px-3 py-3">
                          <FormularioCorreccion
                            filaId={f.id}
                            normalizados={norm}
                            onGuardar={corregir}
                            onCancelar={() => setFilaEnEdicion(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormularioCorreccion({
  filaId,
  normalizados,
  onGuardar,
  onCancelar,
}: {
  filaId: string;
  normalizados: Record<string, unknown> | null;
  onGuardar: (
    filaId: string,
    correccion: CorreccionFila,
  ) => Promise<{ ok: boolean; error?: string; errores?: string[]; advertencias?: string[] }>;
  onCancelar: () => void;
}) {
  const [guia, setGuia] = useState((normalizados?.guia as string) ?? "");
  const [placa, setPlaca] = useState((normalizados?.placaNormalizada as string) ?? "");
  const [fechaCreacion, setFechaCreacion] = useState((normalizados?.fechaCreacion as string) ?? "");
  const [valor, setValor] = useState(normalizados?.valor != null ? String(normalizados.valor) : "");
  const [tipoRuta, setTipoRuta] = useState((normalizados?.tipoRuta as string) ?? "");
  const [estado, setEstado] = useState((normalizados?.estadoFenix as string) ?? "");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{
    errores?: string[];
    advertencias?: string[];
    error?: string;
  } | null>(null);

  async function guardar() {
    setGuardando(true);
    setResultado(null);
    const r = await onGuardar(filaId, { guia, placa, fechaCreacion, valor, tipoRuta, estado });
    setGuardando(false);
    if (!r.ok) setResultado({ error: r.error ?? "No se pudo corregir la fila." });
    else if ((r.errores?.length ?? 0) > 0) {
      setResultado({ errores: r.errores, advertencias: r.advertencias });
    }
    // si quedó sin errores, el padre ya cierra el editor (setFilaEnEdicion(null))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Campo etiqueta="Guía">
          <Input value={guia} onChange={(e) => setGuia(e.target.value)} />
        </Campo>
        <Campo etiqueta="Placa">
          <Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
        </Campo>
        <Campo etiqueta="Fecha Creación">
          <Input type="date" value={fechaCreacion} onChange={(e) => setFechaCreacion(e.target.value)} />
        </Campo>
        <Campo etiqueta="Valor">
          <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
        <Campo etiqueta="Tipo de Ruta">
          <Input value={tipoRuta} onChange={(e) => setTipoRuta(e.target.value)} />
        </Campo>
        <Campo etiqueta="Estado">
          <Input value={estado} onChange={(e) => setEstado(e.target.value)} />
        </Campo>
      </div>

      {resultado?.error ? <p className="text-xs text-destructive">{resultado.error}</p> : null}
      {resultado?.errores && resultado.errores.length > 0 ? (
        <p className="text-xs text-destructive">
          Todavía hay errores, no se insertará: {resultado.errores.join(" · ")}
        </p>
      ) : null}
      {resultado?.advertencias && resultado.advertencias.length > 0 ? (
        <p className="text-xs text-amber-600">Quedan advertencias: {resultado.advertencias.join(" · ")}</p>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" onClick={guardar} disabled={guardando}>
          {guardando ? "Revalidando..." : "Guardar y revalidar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span>{etiqueta}</span>
      {children}
    </label>
  );
}

function Resumen({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: number;
  tono?: "ok" | "error" | "advertencia";
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p
        className={cn(
          "text-2xl font-bold",
          tono === "ok" && "text-primary",
          tono === "error" && "text-destructive",
          tono === "advertencia" && "text-amber-600",
        )}
      >
        {valor}
      </p>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
    </div>
  );
}
