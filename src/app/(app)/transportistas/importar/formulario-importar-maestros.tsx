"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cancelarLoteAction,
  crearLoteAction,
  incrementarProgresoLoteAction,
  obtenerLoteEnCursoAction,
} from "@/lib/ejecuciones/actions";
import type { LoteProceso } from "@/lib/ejecuciones/queries";
import {
  analizarArchivoVehiculosAction,
  importarLoteVehiculosAction,
  type FilaVehiculoAImportar,
  type ResultadoFilaMaestro,
} from "@/lib/maestros/importar-actions";

const TAMANO_LOTE = 5;

export function FormularioImportarMaestros() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState<{ procesadas: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoFilaMaestro[] | null>(null);
  const [loteEnCurso, setLoteEnCurso] = useState<LoteProceso | null>(null);
  const [verificando, setVerificando] = useState(true);
  const loteIdRef = useRef<string | null>(null);
  const canceladoRef = useRef(false);

  useEffect(() => {
    obtenerLoteEnCursoAction("MAESTROS").then((lote) => {
      setLoteEnCurso(lote);
      setVerificando(false);
    });
  }, []);

  async function cancelar() {
    canceladoRef.current = true;
    const id = loteIdRef.current ?? loteEnCurso?.id;
    if (id) await cancelarLoteAction(id);
    setLoteEnCurso(null);
    setCargando(false);
  }

  async function subir() {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    setResultados(null);
    setProgreso(null);
    setLoteEnCurso(null);
    canceladoRef.current = false;

    try {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const analisis = await analizarArchivoVehiculosAction(formData);
      if (!analisis.ok) {
        setError(analisis.error ?? "No se pudo leer el archivo.");
        return;
      }

      const filas = analisis.filas;
      if (filas.length === 0) {
        setResultados([]);
        setArchivo(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      const lotes: FilaVehiculoAImportar[][] = [];
      for (let i = 0; i < filas.length; i += TAMANO_LOTE) lotes.push(filas.slice(i, i + TAMANO_LOTE));

      const creacion = await crearLoteAction({
        tipo: "MAESTROS",
        total: filas.length,
        detalle: `Carga de maestros · ${archivo.name}`,
      });
      if (!creacion.ok || !creacion.loteId) {
        setError(creacion.error ?? "No se pudo iniciar la ejecución.");
        return;
      }
      loteIdRef.current = creacion.loteId;

      const acumulados: ResultadoFilaMaestro[] = [];
      const lotesFallidos: string[] = [];
      let procesadas = 0;
      setProgreso({ procesadas, total: filas.length });

      for (const lote of lotes) {
        if (canceladoRef.current) break;
        let resultado = await importarLoteVehiculosAction(lote).catch(() => null);
        if (!resultado || !resultado.ok) {
          // Un solo reintento antes de darnos por vencidos con este lote — así
          // una falla puntual de red no frena el resto del archivo.
          resultado = await importarLoteVehiculosAction(lote).catch(() => null);
        }

        if (resultado && resultado.ok) {
          acumulados.push(...resultado.resultados);
          for (const fila of resultado.resultados) {
            await incrementarProgresoLoteAction(creacion.loteId, fila.accion !== "ERROR");
          }
        } else {
          const filasTexto = lote.map((f) => f.numeroFila).join(", ");
          lotesFallidos.push(filasTexto);
          for (let i = 0; i < lote.length; i++) await incrementarProgresoLoteAction(creacion.loteId, false);
        }

        procesadas += lote.length;
        setProgreso({ procesadas, total: filas.length });
        setResultados([...acumulados]);
      }

      loteIdRef.current = null;
      if (canceladoRef.current) {
        return;
      }

      if (lotesFallidos.length > 0) {
        setError(
          `No se pudieron procesar las filas ${lotesFallidos.join(", ")} tras reintentar (fallo de conexión). ` +
            "Vuelve a subir el mismo archivo — es seguro repetirlo, no duplica lo que ya se guardó.",
        );
      } else {
        setArchivo(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch {
      setError("Se perdió la conexión con el servidor al leer el archivo. Intenta subirlo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  const filas = resultados ?? [];
  const creados = filas.filter((f) => f.accion === "CREADO").length;
  const actualizados = filas.filter((f) => f.accion === "ACTUALIZADO").length;
  const errores = filas.filter((f) => f.accion === "ERROR").length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <Button asChild variant="outline">
          <a href="/api/maestros/plantilla">Descargar plantilla (.xlsx)</a>
        </Button>
      </div>

      {!verificando && loteEnCurso && !cargando ? (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="text-foreground">
            Quedó una carga de maestros a medias ({loteEnCurso.exitosos + loteEnCurso.fallidos}/
            {loteEnCurso.total} filas) — probablemente porque se cambió de pantalla antes de terminar. Vuelve
            a subir el mismo archivo para completarla: es seguro repetirlo, no duplica lo que ya se guardó.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={cancelar}
          >
            Cancelar esa ejecución
          </Button>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-center gap-2">
          <Button onClick={subir} disabled={!archivo || cargando}>
            {cargando
              ? progreso
                ? `Procesando ${progreso.procesadas} / ${progreso.total} filas...`
                : "Leyendo archivo..."
              : "Subir y cargar"}
          </Button>
          {cargando ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={cancelar}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
        {cargando ? (
          <p className="text-xs text-muted-foreground">
            Se procesa en lotes pequeños, así que puedes seguir el avance aquí mismo. Con archivos grandes
            puede tardar uno o dos minutos — si cambias de pantalla a medias, no se pierde: puedes volver a
            subir el mismo archivo más tarde para completarla, o cancelarla desde /ejecuciones.
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {resultados ? (
        filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">La hoja no tenía filas.</p>
        ) : (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Resultado</h2>
            <p className="text-sm text-muted-foreground">
              {creados} creados · {actualizados} actualizados
              {errores > 0 ? ` · ${errores} con error` : ""}
            </p>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fila</th>
                    <th className="px-3 py-2 font-medium">Placa</th>
                    <th className="px-3 py-2 font-medium">Resultado</th>
                    <th className="px-3 py-2 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filas.map((f, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{f.fila}</td>
                      <td className="px-3 py-2">{f.clave}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            f.accion === "ERROR"
                              ? "text-destructive"
                              : f.detalle
                                ? "text-amber-600"
                                : "text-primary-ink"
                          }
                        >
                          {f.accion === "CREADO"
                            ? "Creado"
                            : f.accion === "ACTUALIZADO"
                              ? "Actualizado"
                              : "Error"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{f.detalle ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
