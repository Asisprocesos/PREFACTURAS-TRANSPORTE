"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CAMPOS_ODT,
  camposObligatoriosFaltantes,
  ETIQUETA_CAMPO,
  type CampoOdt,
} from "@/lib/importador/campos";
import { confirmarLoteImportacionAction } from "@/lib/importador/confirmar-action";
import { calcularHashArchivo } from "@/lib/importador/hash";
import { guardarAliasMapeoAction, obtenerAliasMapeoAction } from "@/lib/importador/lectura-actions";
import { sugerirMapeo } from "@/lib/importador/mapeo";
import { registrarImportacion } from "@/lib/importador/registro";
import { crearUrlSubidaImportacion } from "@/lib/importador/storage";
import { useExcelWorker } from "@/lib/importador/use-excel-worker";
import { validarImportacionAction } from "@/lib/importador/validar-action";
import { createClient } from "@/lib/supabase/client";

import { ResultadosValidacion } from "./resultados-validacion";
import { Stepper } from "./stepper";
import { ESTADO_INICIAL, type EstadoImportador } from "./tipos";

interface PeriodoOpcion {
  id: string;
  numero: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
}

export function ImportarWizard({ periodos, esAdmin }: { periodos: PeriodoOpcion[]; esAdmin: boolean }) {
  const [estado, setEstado] = useState<EstadoImportador>(ESTADO_INICIAL);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [plantillaGuardada, setPlantillaGuardada] = useState(false);
  const { analizar, previsualizar } = useExcelWorker();

  function actualizar(cambios: Partial<EstadoImportador>) {
    setEstado((prev) => ({ ...prev, ...cambios }));
  }

  // ---- Paso 1: Cargar ----
  async function subirArchivo() {
    if (!estado.archivo) return;
    setCargando(true);
    setError(null);
    setAvisoDuplicado(null);
    try {
      const hash = await calcularHashArchivo(estado.archivo);
      const { storageKey, urlFirmada, token } = await crearUrlSubidaImportacion(
        estado.archivo.name,
        estado.archivo.size,
      );

      const supabase = createClient();
      const { error: errorSubida } = await supabase.storage
        .from("imports")
        .uploadToSignedUrl(storageKey, token, estado.archivo);
      if (errorSubida) throw new Error(`No se pudo subir el archivo: ${errorSubida.message}`);
      void urlFirmada;

      const resultado = await registrarImportacion({
        archivo: estado.archivo.name,
        storageKey,
        hashSha256: hash,
      });

      if (resultado.yaExistia && resultado.importacionPrevia) {
        setAvisoDuplicado(
          `Este archivo ya se importó antes (${resultado.importacionPrevia.archivo}, estado ${resultado.importacionPrevia.estado}). Puedes continuar para revalidarlo.`,
        );
      }

      actualizar({ importacionId: resultado.id, paso: 2 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error al subir el archivo.");
    } finally {
      setCargando(false);
    }
  }

  // ---- Paso 2: Leer ----
  async function leerHojas() {
    if (!estado.archivo) return;
    setCargando(true);
    setError(null);
    try {
      const { hojas } = await analizar(estado.archivo);
      actualizar({ hojas, hojaElegida: hojas[0]?.nombre ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setCargando(false);
    }
  }

  async function elegirHoja(hoja: string) {
    setCargando(true);
    setError(null);
    try {
      const previa = await previsualizar(hoja);
      const alias = await obtenerAliasMapeoAction();
      const sugerencia = sugerirMapeo(previa.encabezados, alias);
      actualizar({
        hojaElegida: hoja,
        encabezados: previa.encabezados,
        filasPreview: previa.filas,
        mapeo: sugerencia,
        paso: 3,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo previsualizar la hoja.");
    } finally {
      setCargando(false);
    }
  }

  // ---- Paso 3: Mapear -> Validar ----
  async function validar() {
    if (!estado.importacionId || !estado.hojaElegida || !estado.periodoId) {
      setError("Elige un período antes de validar.");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const resumen = await validarImportacionAction({
        importacionId: estado.importacionId,
        periodoId: estado.periodoId,
        hoja: estado.hojaElegida,
        mapeo: estado.mapeo,
      });
      actualizar({ resumen, paso: 4 });
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
      const alias = Object.entries(estado.mapeo)
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

  return (
    <Card>
      <CardHeader>
        <Stepper pasoActual={estado.paso} />
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {avisoDuplicado ? <p className="text-sm text-amber-600">{avisoDuplicado}</p> : null}

        {estado.paso === 1 ? (
          <div className="space-y-3">
            <Input
              type="file"
              accept=".xlsx,.xls,.xlsb,.csv"
              onChange={(e) => actualizar({ archivo: e.target.files?.[0] ?? null })}
            />
            <Button onClick={subirArchivo} disabled={!estado.archivo || cargando}>
              {cargando ? "Subiendo..." : "Subir y continuar"}
            </Button>
          </div>
        ) : null}

        {estado.paso === 2 ? (
          <div className="space-y-3">
            {estado.hojas.length === 0 ? (
              <Button onClick={leerHojas} disabled={cargando}>
                {cargando ? "Leyendo..." : "Leer hojas del archivo"}
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Elige la hoja con los datos del corte:</p>
                <ul className="space-y-1">
                  {estado.hojas.map((h) => (
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
        ) : null}

        {estado.paso === 3 ? (
          <div className="space-y-4">
            {(() => {
              const faltantes = camposObligatoriosFaltantes(estado.mapeo);
              return faltantes.length > 0 ? (
                <p className="text-sm text-destructive">
                  Falta mapear columnas obligatorias: {faltantes.map((c) => ETIQUETA_CAMPO[c]).join(", ")}.
                  &quot;Estado&quot; es la que decide qué filas se importan (solo &quot;Entregado&quot;); sin
                  mapearla, todas quedarían excluidas.
                </p>
              ) : null;
            })()}
            <div className="max-w-xs space-y-2">
              <label className="text-sm font-medium">Período del corte</label>
              <select
                value={estado.periodoId}
                onChange={(e) => actualizar({ periodoId: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecciona un período</option>
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.estado})
                  </option>
                ))}
              </select>
              {periodos.length === 0 ? (
                <p className="text-xs text-destructive">
                  No hay períodos creados. Créalos en Configuración → Catálogos antes de continuar.
                </p>
              ) : null}
            </div>

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
                  {estado.encabezados.map((encabezado, idx) => (
                    <tr key={encabezado + idx}>
                      <td className="px-3 py-2 font-medium">{encabezado || "(sin nombre)"}</td>
                      <td className="px-3 py-2">
                        <select
                          value={estado.mapeo[encabezado] ?? ""}
                          onChange={(e) =>
                            actualizar({
                              mapeo: {
                                ...estado.mapeo,
                                [encabezado]: (e.target.value || null) as CampoOdt | null,
                              },
                            })
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
                        {String(estado.filasPreview[0]?.[idx] ?? "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={validar}
                disabled={cargando || camposObligatoriosFaltantes(estado.mapeo).length > 0}
              >
                {cargando ? "Validando..." : "Validar"}
              </Button>
              <Button variant="outline" onClick={guardarPlantilla} disabled={guardandoPlantilla}>
                {guardandoPlantilla ? "Guardando..." : "Guardar mapeo como plantilla"}
              </Button>
              {plantillaGuardada ? (
                <span className="text-sm text-primary-ink">Plantilla guardada.</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {estado.paso === 4 && estado.resumen && estado.importacionId ? (
          <div className="space-y-4">
            <ResultadosValidacion
              importacionId={estado.importacionId}
              resumen={estado.resumen}
              onResumenActualizado={(resumen) => actualizar({ resumen })}
              puedeAdministrarCatalogo={esAdmin}
            />
            <p className="text-sm text-muted-foreground">
              {estado.resumen.filasParaInsertar} de {estado.resumen.filasLeidas} filas se insertarán al
              confirmar (las marcadas &quot;Se insertará&quot; en Errores/Advertencias, más las de la pestaña
              Válidas). Usa Omitir/Insertar/Corregir en las pestañas de arriba para ajustar cuáles.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => actualizar({ paso: 3 })}>
                Corregir mapeo y revalidar
              </Button>
              <Button
                onClick={() => actualizar({ paso: 5 })}
                disabled={estado.resumen.filasParaInsertar === 0}
              >
                Continuar a confirmar
              </Button>
            </div>
          </div>
        ) : null}

        {estado.paso === 5 && estado.importacionId ? (
          <PasoConfirmar
            importacionId={estado.importacionId}
            totalParaInsertar={estado.resumen?.filasParaInsertar ?? 0}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function PasoConfirmar({
  importacionId,
  totalParaInsertar,
}: {
  importacionId: string;
  totalParaInsertar: number;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<{ odtInsertadas?: number; novedadesGeneradas?: number } | null>(
    null,
  );

  async function confirmar() {
    setCargando(true);
    setError(null);
    setProgreso(0);
    let totalOdt = 0;
    let totalNovedades = 0;
    try {
      for (;;) {
        let r = await confirmarLoteImportacionAction(importacionId).catch(() => null);
        if (!r || !r.ok) {
          // Un solo reintento antes de rendirnos con esta vuelta — un lote
          // ya confirmado no se vuelve a insertar, así que es seguro seguir
          // dándole "Confirmar importación" hasta terminar.
          r = await confirmarLoteImportacionAction(importacionId).catch(() => null);
        }
        if (!r || !r.ok) {
          setError(
            totalOdt > 0
              ? `Se insertaron ${totalOdt} ODT antes de perder la conexión. Vuelve a darle "Confirmar importación" para continuar con el resto (es seguro, no duplica lo ya insertado).`
              : (r?.error ?? "No se pudo confirmar la importación."),
          );
          return;
        }
        totalOdt += r.odtInsertadas ?? 0;
        totalNovedades += r.novedadesGeneradas ?? 0;
        setProgreso(totalOdt);
        if (!r.filasRestantes) break;
      }
      setResultado({ odtInsertadas: totalOdt, novedadesGeneradas: totalNovedades });
    } finally {
      setCargando(false);
    }
  }

  if (resultado) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-primary-ink">
          Importación confirmada: {resultado.odtInsertadas} ODT insertadas, {resultado.novedadesGeneradas}{" "}
          novedades generadas.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/importar">Volver a Importar</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Ir al Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Se insertarán las filas marcadas como válidas, en lotes pequeños. Si algo falla a mitad de camino, lo
        ya insertado queda guardado — vuelve a darle &quot;Confirmar importación&quot; para continuar con el
        resto (es seguro, no duplica nada).
      </p>
      {cargando ? (
        <p className="text-sm text-muted-foreground">
          Confirmando... {progreso} / {totalParaInsertar} ODT insertadas hasta ahora.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button onClick={confirmar} disabled={cargando}>
        {cargando ? "Confirmando..." : "Confirmar importación"}
      </Button>
    </div>
  );
}
