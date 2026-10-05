"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { confirmarLoteImportacionAction } from "@/lib/importador/confirmar-action";
import { calcularHashArchivo } from "@/lib/importador/hash";
import { registrarImportacion } from "@/lib/importador/registro";
import { crearUrlSubidaImportacion } from "@/lib/importador/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { PasoMapeo } from "./paso-mapeo";
import { ResultadosValidacion } from "./resultados-validacion";
import { Stepper } from "./stepper";
import { ESTADO_INICIAL, type EstadoImportador, type PeriodoOpcion } from "./tipos";

const EXTENSIONES_ACEPTADAS = [".xlsx", ".xls", ".xlsb", ".csv"];

function extensionAceptada(nombreArchivo: string): boolean {
  const nombre = nombreArchivo.toLowerCase();
  return EXTENSIONES_ACEPTADAS.some((ext) => nombre.endsWith(ext));
}

export function ImportarWizard({ periodos, esAdmin }: { periodos: PeriodoOpcion[]; esAdmin: boolean }) {
  const [estado, setEstado] = useState<EstadoImportador>(ESTADO_INICIAL);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  function actualizar(cambios: Partial<EstadoImportador>) {
    setEstado((prev) => ({ ...prev, ...cambios }));
  }

  // ---- Paso 1: Cargar ----
  function onSoltarArchivo(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastrando(false);
    const archivo = e.dataTransfer.files?.[0];
    if (!archivo) return;
    if (!extensionAceptada(archivo.name)) {
      setError(`Formato no soportado. Usa: ${EXTENSIONES_ACEPTADAS.join(", ")}.`);
      return;
    }
    setError(null);
    actualizar({ archivo });
  }

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
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={onSoltarArchivo}
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                arrastrando ? "border-primary-ink bg-primary/5" : "border-input",
              )}
            >
              <p className="text-sm text-muted-foreground">Arrastra y suelta el archivo aquí, o elige uno:</p>
              <Input
                type="file"
                accept=".xlsx,.xls,.xlsb,.csv"
                onChange={(e) => actualizar({ archivo: e.target.files?.[0] ?? null })}
                className="max-w-sm"
              />
              {estado.archivo ? <p className="text-sm font-medium">{estado.archivo.name}</p> : null}
            </div>
            <Button onClick={subirArchivo} disabled={!estado.archivo || cargando}>
              {cargando ? "Subiendo..." : "Subir y continuar"}
            </Button>
          </div>
        ) : null}

        {(estado.paso === 2 || estado.paso === 3) && estado.archivo && estado.importacionId ? (
          <PasoMapeo
            importacionId={estado.importacionId}
            archivo={estado.archivo}
            periodos={periodos}
            onPaso={(paso) => actualizar({ paso })}
            onValidado={(resumen) => actualizar({ resumen, paso: 4 })}
          />
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
