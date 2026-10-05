"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CAMPOS_ODT,
  camposObligatoriosFaltantes,
  ETIQUETA_CAMPO,
  type CampoOdt,
} from "@/lib/importador/campos";
import {
  detectarOCrearPeriodoAction,
  type ResultadoDeteccionPeriodo,
} from "@/lib/importador/detectar-periodo-action";
import {
  guardarAliasMapeoAction,
  guardarBorradorImportacionAction,
  obtenerAliasMapeoAction,
  type BorradorMapeo,
} from "@/lib/importador/lectura-actions";
import { sugerirMapeo } from "@/lib/importador/mapeo";
import { useExcelWorker } from "@/lib/importador/use-excel-worker";
import { validarImportacionAction, type ResumenValidacion } from "@/lib/importador/validar-action";

import type { PeriodoOpcion } from "./tipos";

const RETARDO_GUARDADO_BORRADOR_MS = 400;

/**
 * Pasos 2 (elegir hoja) y 3 (mapear columnas + elegir período + validar) del
 * asistente de importación, en un solo componente — así se puede usar tanto
 * desde el asistente normal (importar-wizard.tsx, archivo recién elegido en
 * el navegador) como para reanudar un BORRADOR abandonado a medias desde
 * /importar/{id} (detalle-importacion.tsx, archivo recuperado de Storage).
 *
 * Cada elección (hoja, fila de encabezado, mapeo, período) se persiste en
 * `importacion.borrador` apenas se hace, para que la reanudación sea posible.
 */
export function PasoMapeo({
  importacionId,
  archivo,
  periodos,
  borradorInicial,
  onPaso,
  onValidado,
}: {
  importacionId: string;
  archivo: File;
  periodos: PeriodoOpcion[];
  borradorInicial?: BorradorMapeo;
  onPaso?: (paso: 2 | 3) => void;
  onValidado: (resumen: ResumenValidacion) => void;
}) {
  const { analizar, previsualizar } = useExcelWorker();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hojas, setHojas] = useState<{ nombre: string; filas: number }[]>([]);
  const [hojaElegida, setHojaElegida] = useState<string | null>(null);
  const [filaEncabezado, setFilaEncabezado] = useState(0);
  const [filasCrudas, setFilasCrudas] = useState<unknown[][]>([]);
  const [encabezados, setEncabezados] = useState<string[]>([]);
  const [filasPreview, setFilasPreview] = useState<unknown[][]>([]);
  const [mapeo, setMapeo] = useState<Record<string, CampoOdt | null>>({});
  const [periodoId, setPeriodoId] = useState(borradorInicial?.periodoId ?? "");
  const [periodoManual, setPeriodoManual] = useState(!!borradorInicial?.periodoId);
  const [deteccionPeriodo, setDeteccionPeriodo] = useState<ResultadoDeteccionPeriodo | null>(null);
  const [detectandoPeriodo, setDetectandoPeriodo] = useState(false);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [plantillaGuardada, setPlantillaGuardada] = useState(false);
  const inicializado = useRef(false);

  const columnaFecha = Object.entries(mapeo).find(([, campo]) => campo === "fecha_creacion")?.[0] ?? null;

  useEffect(() => {
    onPaso?.(hojaElegida ? 3 : 2);
  }, [hojaElegida, onPaso]);

  // Carga automática apenas hay archivo (recién elegido, o recuperado de
  // Storage al reanudar): si el borrador ya tenía una hoja elegida, la
  // vuelve a seleccionar con su fila de encabezado y mapeo guardados en vez
  // de recalcular la sugerencia desde cero.
  useEffect(() => {
    if (inicializado.current) return;
    inicializado.current = true;
    setCargando(true);
    setError(null);
    analizar(archivo)
      .then(async ({ hojas: hojasLeidas }) => {
        setHojas(hojasLeidas);
        const hojaInicial = borradorInicial?.hojaElegida ?? null;
        const existe = hojaInicial && hojasLeidas.some((h) => h.nombre === hojaInicial);
        if (existe) await elegirHoja(hojaInicial!, borradorInicial);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo leer el archivo."))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo]);

  // Apenas se mapea la columna de Fecha Creación, se detecta/crea el período
  // solo — el dropdown manual queda solo para corregirlo.
  useEffect(() => {
    if (!columnaFecha || !hojaElegida || periodoManual) return;
    let cancelado = false;
    setDetectandoPeriodo(true);
    setDeteccionPeriodo(null);
    detectarOCrearPeriodoAction({ importacionId, hoja: hojaElegida, columnaFecha, filaEncabezado }).then(
      (resultado) => {
        if (cancelado) return;
        setDetectandoPeriodo(false);
        setDeteccionPeriodo(resultado);
        if (resultado.ok && resultado.periodoId) setPeriodoId(resultado.periodoId);
      },
    );
    return () => {
      cancelado = true;
    };
  }, [importacionId, columnaFecha, hojaElegida, filaEncabezado, periodoManual]);

  // Persiste cada elección para poder reanudar si se abandona a medias.
  useEffect(() => {
    if (!hojaElegida) return;
    const temporizador = setTimeout(() => {
      guardarBorradorImportacionAction(importacionId, {
        hojaElegida,
        filaEncabezado,
        mapeo,
        periodoId,
      }).catch(() => {
        // Si falla el guardado del borrador no se interrumpe el flujo —
        // en el peor caso, retomarlo más tarde empieza desde la hoja en vez
        // de desde el mapeo exacto.
      });
    }, RETARDO_GUARDADO_BORRADOR_MS);
    return () => clearTimeout(temporizador);
  }, [importacionId, hojaElegida, filaEncabezado, mapeo, periodoId]);

  async function elegirHoja(hoja: string, borrador?: BorradorMapeo) {
    setCargando(true);
    setError(null);
    try {
      const previa = await previsualizar(hoja, borrador?.filaEncabezado);
      let mapeoElegido = borrador?.mapeo;
      if (!mapeoElegido) {
        const alias = await obtenerAliasMapeoAction();
        mapeoElegido = sugerirMapeo(previa.encabezados, alias);
      }
      setHojaElegida(hoja);
      setFilaEncabezado(previa.filaEncabezado);
      setFilasCrudas(previa.filasCrudas);
      setEncabezados(previa.encabezados);
      setFilasPreview(previa.filas);
      setMapeo(mapeoElegido);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo previsualizar la hoja.");
    } finally {
      setCargando(false);
    }
  }

  // El usuario corrige a mano cuál fila es el encabezado real (ej. cuando el
  // archivo trae un título o banner arriba, como "REPORTE CHOFERES", que la
  // detección automática no siempre reconoce como tal).
  async function cambiarFilaEncabezado(nuevaFila: number) {
    if (!hojaElegida) return;
    setCargando(true);
    setError(null);
    try {
      const previa = await previsualizar(hojaElegida, nuevaFila);
      const alias = await obtenerAliasMapeoAction();
      const sugerencia = sugerirMapeo(previa.encabezados, alias);
      setFilaEncabezado(previa.filaEncabezado);
      setFilasCrudas(previa.filasCrudas);
      setEncabezados(previa.encabezados);
      setFilasPreview(previa.filas);
      setMapeo(sugerencia);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo volver a leer la hoja.");
    } finally {
      setCargando(false);
    }
  }

  async function validar() {
    if (!hojaElegida || !periodoId) {
      setError("Elige un período antes de validar.");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const resumen = await validarImportacionAction({
        importacionId,
        periodoId,
        hoja: hojaElegida,
        mapeo,
        filaEncabezado,
      });
      onValidado(resumen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo validar la importación.");
    } finally {
      setCargando(false);
    }
  }

  async function guardarPlantilla() {
    setGuardandoPlantilla(true);
    setPlantillaGuardada(false);
    try {
      const alias = Object.entries(mapeo)
        .filter((entrada): entrada is [string, CampoOdt] => entrada[1] !== null)
        .map(([alias_origen, campo]) => ({ alias_origen, campo_interno: `odt.${campo}` }));
      await guardarAliasMapeoAction(alias);
      setPlantillaGuardada(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la plantilla de mapeo.");
    } finally {
      setGuardandoPlantilla(false);
    }
  }

  if (!hojaElegida) {
    return (
      <div className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {cargando ? (
          <p className="text-sm text-muted-foreground">Leyendo el archivo...</p>
        ) : hojas.length === 0 ? (
          <p className="text-sm text-muted-foreground">El archivo no tiene hojas legibles.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Elige la hoja con los datos del corte:</p>
            <ul className="space-y-1">
              {hojas.map((h) => (
                <li key={h.nombre}>
                  <button
                    type="button"
                    onClick={() => elegirHoja(h.nombre)}
                    disabled={cargando}
                    className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{h.nombre}</span>{" "}
                    <span className="text-muted-foreground">({h.filas} filas)</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {(() => {
        const faltantes = camposObligatoriosFaltantes(mapeo);
        return faltantes.length > 0 ? (
          <p className="text-sm text-destructive">
            Falta mapear columnas obligatorias: {faltantes.map((c) => ETIQUETA_CAMPO[c]).join(", ")}.
            &quot;Estado&quot; es la que decide qué filas se importan (solo &quot;Entregado&quot;); sin
            mapearla, todas quedarían excluidas.
          </p>
        ) : null;
      })()}
      <div className="max-w-sm space-y-2">
        <label className="text-sm font-medium">Período del corte</label>
        {!columnaFecha ? (
          <p className="text-xs text-muted-foreground">
            Mapea la columna &quot;Fecha Creación&quot; para que el sistema detecte el período solo.
          </p>
        ) : periodoManual ? (
          <div className="space-y-1">
            <select
              value={periodoId}
              onChange={(e) => setPeriodoId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecciona un período</option>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.estado})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-xs text-primary-ink hover:underline"
              onClick={() => setPeriodoManual(false)}
            >
              Volver a detección automática
            </button>
          </div>
        ) : detectandoPeriodo ? (
          <p className="text-sm text-muted-foreground">Detectando período a partir del archivo...</p>
        ) : deteccionPeriodo?.ok ? (
          <div className="space-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
            <p>
              <span className="font-medium">{deteccionPeriodo.periodoNombre}</span>{" "}
              {deteccionPeriodo.creado ? "(creado automáticamente)" : "(ya existía)"}
            </p>
            <p className="text-xs text-muted-foreground">
              {deteccionPeriodo.filasEnVentana} fila(s) en este período
              {deteccionPeriodo.filasFueraDeVentana
                ? `, ${deteccionPeriodo.filasFueraDeVentana} fuera de rango (quedarán marcadas como advertencia)`
                : ""}
              .
            </p>
            <button
              type="button"
              className="text-xs text-primary-ink hover:underline"
              onClick={() => setPeriodoManual(true)}
            >
              Cambiar manualmente
            </button>
          </div>
        ) : deteccionPeriodo && !deteccionPeriodo.ok ? (
          <div className="space-y-1">
            <p className="text-xs text-destructive">{deteccionPeriodo.error}</p>
            <button
              type="button"
              className="text-xs text-primary-ink hover:underline"
              onClick={() => setPeriodoManual(true)}
            >
              Elegir período manualmente
            </button>
          </div>
        ) : null}
        {periodos.length === 0 && periodoManual ? (
          <p className="text-xs text-destructive">
            No hay períodos creados. Créalos en Configuración antes de continuar.
          </p>
        ) : null}
      </div>

      {filasCrudas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="filaEncabezado" className="font-medium">
            Fila de encabezado:
          </label>
          <select
            id="filaEncabezado"
            value={filaEncabezado}
            disabled={cargando}
            onChange={(e) => cambiarFilaEncabezado(Number(e.target.value))}
            className="h-8 max-w-sm rounded-md border border-input bg-background px-2 text-xs"
          >
            {filasCrudas.map((fila, idx) => {
              const previa = fila
                .slice(0, 6)
                .map((c) => String(c ?? "").trim())
                .filter(Boolean)
                .join(" · ");
              return (
                <option key={idx} value={idx}>
                  Fila {idx + 1}
                  {previa ? ` — ${previa}` : " (vacía)"}
                </option>
              );
            })}
          </select>
          <span className="text-xs text-muted-foreground">
            Cámbiala si el archivo trae un título arriba de las columnas (ej. &quot;Reporte Choferes&quot;).
          </span>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Columna del archivo</th>
              <th className="px-3 py-2 font-medium">Campo interno</th>
              <th className="px-3 py-2 font-medium">Ejemplo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {encabezados.map((encabezado, idx) => (
              <tr key={encabezado + idx}>
                <td className="px-3 py-2 font-medium">{encabezado || "(sin nombre)"}</td>
                <td className="px-3 py-2">
                  <select
                    value={mapeo[encabezado] ?? ""}
                    onChange={(e) =>
                      setMapeo({ ...mapeo, [encabezado]: (e.target.value || null) as CampoOdt | null })
                    }
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Ignorar</option>
                    {CAMPOS_ODT.map((campo) => (
                      <option key={campo} value={campo}>
                        {ETIQUETA_CAMPO[campo]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {String(filasPreview[0]?.[idx] ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={validar}
          disabled={
            cargando || detectandoPeriodo || !periodoId || camposObligatoriosFaltantes(mapeo).length > 0
          }
        >
          {cargando ? "Validando..." : "Validar"}
        </Button>
        <Button variant="outline" onClick={guardarPlantilla} disabled={guardandoPlantilla}>
          {guardandoPlantilla ? "Guardando..." : "Guardar mapeo como plantilla"}
        </Button>
        {plantillaGuardada ? <span className="text-sm text-primary-ink">Plantilla guardada.</span> : null}
      </div>
    </div>
  );
}
