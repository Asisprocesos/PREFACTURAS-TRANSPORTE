"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmarLoteImportacionAction } from "@/lib/importador/confirmar-action";
import { validarFilaManualAction, crearImportacionManualAction } from "@/lib/importador/manual-action";
import type { CampoOdt } from "@/lib/importador/campos";
import type { FilaValidada } from "@/lib/importador/validar";
import { generarPrefacturasPeriodoAction } from "@/lib/prefacturas/actions";
import { cn } from "@/lib/utils";

interface PeriodoOpcion {
  id: string;
  numero: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
}

interface FilaEnLista {
  key: string;
  campos: Partial<Record<CampoOdt, string>>;
  resultado: FilaValidada;
}

const DRAFT_INICIAL: Partial<Record<CampoOdt, string>> = { estado: "Entregado" };

/** Se guardan siempre en mayúsculas (ver validarFila), así que se reflejan igual mientras se escriben. */
const CAMPOS_MAYUSCULAS = new Set<CampoOdt>(["guia", "placa", "tipo_ruta"]);

function isoADdMmAaaa(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Convierte las fechas del formulario (yyyy-mm-dd, formato de <input type="date">) al dd/mm/aaaa que espera validarFila. */
function campoParaEnvio(draft: Partial<Record<CampoOdt, string>>): Partial<Record<CampoOdt, string>> {
  return {
    ...draft,
    fecha_creacion: draft.fecha_creacion ? isoADdMmAaaa(draft.fecha_creacion) : draft.fecha_creacion,
    fecha_recepcion: draft.fecha_recepcion ? isoADdMmAaaa(draft.fecha_recepcion) : draft.fecha_recepcion,
  };
}

function nuevaClave(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function IngresoManualForm({
  periodos,
  periodoInicial,
}: {
  periodos: PeriodoOpcion[];
  periodoInicial: string | undefined;
}) {
  const router = useRouter();
  const [periodoId, setPeriodoId] = useState(periodoInicial ?? "");
  const [paso, setPaso] = useState<1 | 2 | 3>(periodoInicial ? 2 : 1);

  const [draft, setDraft] = useState<Partial<Record<CampoOdt, string>>>(DRAFT_INICIAL);
  const [validando, setValidando] = useState(false);
  const [errorDraft, setErrorDraft] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaEnLista[]>([]);

  const [confirmando, setConfirmando] = useState(false);
  const [errorConfirmar, setErrorConfirmar] = useState<string | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [resultadoFinal, setResultadoFinal] = useState<{
    odtInsertadas: number;
    novedadesGeneradas: number;
    prefacturasCreadas?: number;
    prefacturasActualizadas?: number;
  } | null>(null);

  function actualizarDraft(campo: CampoOdt, valor: string) {
    setDraft((d) => ({ ...d, [campo]: CAMPOS_MAYUSCULAS.has(campo) ? valor.toUpperCase() : valor }));
  }

  async function agregarFila() {
    if (!draft.guia?.trim()) {
      setErrorDraft("La guía es obligatoria.");
      return;
    }
    setValidando(true);
    setErrorDraft(null);
    try {
      const campos = campoParaEnvio(draft);
      const resultado = await validarFilaManualAction({
        periodoId,
        fila: campos,
        guiasEnLista: filas.map((f) => f.campos.guia ?? ""),
      });
      setFilas((prev) => [...prev, { key: nuevaClave(), campos, resultado }]);
      setDraft(DRAFT_INICIAL);
    } catch (e) {
      setErrorDraft(e instanceof Error ? e.message : "No se pudo validar la fila.");
    } finally {
      setValidando(false);
    }
  }

  function quitarFila(key: string) {
    setFilas((prev) => prev.filter((f) => f.key !== key));
  }

  const hayFilaInsertable = filas.some((f) => !f.resultado.excluida && f.resultado.errores.length === 0);

  async function confirmar() {
    setConfirmando(true);
    setErrorConfirmar(null);
    setProgreso(0);
    try {
      const registro = await crearImportacionManualAction({
        periodoId,
        filas: filas.map((f) => f.campos),
      });
      if (!registro.ok || !registro.importacionId) {
        setErrorConfirmar(registro.error ?? "No se pudo registrar el ingreso manual.");
        return;
      }

      let totalOdt = 0;
      let totalNovedades = 0;
      for (;;) {
        let r = await confirmarLoteImportacionAction(registro.importacionId).catch(() => null);
        if (!r || !r.ok) {
          r = await confirmarLoteImportacionAction(registro.importacionId).catch(() => null);
        }
        if (!r || !r.ok) {
          setErrorConfirmar(r?.error ?? "No se pudo confirmar el ingreso.");
          return;
        }
        totalOdt += r.odtInsertadas ?? 0;
        totalNovedades += r.novedadesGeneradas ?? 0;
        setProgreso(totalOdt);
        if (!r.filasRestantes) break;
      }

      const generacion = await generarPrefacturasPeriodoAction(periodoId).catch(() => null);

      setResultadoFinal({
        odtInsertadas: totalOdt,
        novedadesGeneradas: totalNovedades,
        prefacturasCreadas: generacion?.ok ? generacion.creadas : undefined,
        prefacturasActualizadas: generacion?.ok ? generacion.actualizadas : undefined,
      });
      router.refresh();
    } finally {
      setConfirmando(false);
    }
  }

  function ingresarOtra() {
    setFilas([]);
    setResultadoFinal(null);
    setErrorConfirmar(null);
    setPaso(2);
  }

  return (
    <div className="space-y-6 rounded-lg border bg-card p-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {(["Período", "Datos ODT", "Confirmar"] as const).map((etiqueta, i) => {
          const numero = (i + 1) as 1 | 2 | 3;
          return (
            <li key={etiqueta} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                  numero === paso
                    ? "bg-primary text-primary-foreground"
                    : numero < paso
                      ? "bg-primary/30 text-primary-foreground/80"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {numero}
              </span>
              <span className={numero === paso ? "font-medium" : "text-muted-foreground"}>{etiqueta}</span>
              {i < 2 ? <span className="mx-1 text-muted-foreground">→</span> : null}
            </li>
          );
        })}
      </ol>

      {paso === 1 ? (
        <div className="max-w-xs space-y-3">
          <label className="text-sm font-medium">Período del corte</label>
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
          <Button onClick={() => setPaso(2)} disabled={!periodoId}>
            Continuar
          </Button>
        </div>
      ) : null}

      {paso === 2 ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Guía *" valor={draft.guia ?? ""} onChange={(v) => actualizarDraft("guia", v)} />
            <Campo etiqueta="Placa" valor={draft.placa ?? ""} onChange={(v) => actualizarDraft("placa", v)} />
            <Campo
              etiqueta="Estado"
              valor={draft.estado ?? ""}
              onChange={(v) => actualizarDraft("estado", v)}
            />
            <Campo
              etiqueta="Fecha Creación *"
              tipo="date"
              valor={draft.fecha_creacion ?? ""}
              onChange={(v) => actualizarDraft("fecha_creacion", v)}
            />
            <Campo
              etiqueta="Fecha Recepción"
              tipo="date"
              valor={draft.fecha_recepcion ?? ""}
              onChange={(v) => actualizarDraft("fecha_recepcion", v)}
            />
            <Campo
              etiqueta="Valor"
              tipo="number"
              valor={draft.valor ?? ""}
              onChange={(v) => actualizarDraft("valor", v)}
            />
            <Campo
              etiqueta="Tipo de Costo"
              valor={draft.tipo_costo ?? ""}
              onChange={(v) => actualizarDraft("tipo_costo", v)}
            />
            <Campo
              etiqueta="Tipo de Ruta"
              valor={draft.tipo_ruta ?? ""}
              onChange={(v) => actualizarDraft("tipo_ruta", v)}
            />
            <Campo
              etiqueta="Chofer"
              valor={draft.chofer ?? ""}
              onChange={(v) => actualizarDraft("chofer", v)}
            />
            <Campo etiqueta="Ruta" valor={draft.ruta ?? ""} onChange={(v) => actualizarDraft("ruta", v)} />
            <Campo
              etiqueta="Ruta/Zona"
              valor={draft.ruta_zona ?? ""}
              onChange={(v) => actualizarDraft("ruta_zona", v)}
            />
            <Campo
              etiqueta="Detalle de la Ruta"
              valor={draft.detalle_ruta ?? ""}
              onChange={(v) => actualizarDraft("detalle_ruta", v)}
            />
            <Campo
              etiqueta="Regional Origen"
              valor={draft.regional_origen ?? ""}
              onChange={(v) => actualizarDraft("regional_origen", v)}
            />
            <Campo
              etiqueta="Regional Destino"
              valor={draft.regional_destino ?? ""}
              onChange={(v) => actualizarDraft("regional_destino", v)}
            />
            <Campo
              etiqueta="Usuario"
              valor={draft.usuario_fenix ?? ""}
              onChange={(v) => actualizarDraft("usuario_fenix", v)}
            />
          </div>

          {errorDraft ? <p className="text-sm text-destructive">{errorDraft}</p> : null}
          <Button onClick={agregarFila} disabled={validando || !draft.guia?.trim()}>
            {validando ? "Validando..." : "Validar y agregar a la lista"}
          </Button>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">
              ODT agregadas ({filas.length}){" "}
              {filas.length > 0 ? (
                <span className="font-normal text-muted-foreground">
                  · {filas.filter((f) => !f.resultado.excluida && f.resultado.errores.length === 0).length} se
                  insertarán
                </span>
              ) : null}
            </h2>
            {filas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no has agregado ninguna ODT.</p>
            ) : (
              <ul className="space-y-2">
                {filas.map((f) => (
                  <li key={f.key} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="font-medium">{f.campos.guia}</span>
                        {f.campos.placa ? (
                          <span className="text-muted-foreground"> · Placa {f.campos.placa}</span>
                        ) : null}
                        {f.campos.valor ? (
                          <span className="text-muted-foreground"> · Valor {f.campos.valor}</span>
                        ) : null}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => quitarFila(f.key)}>
                        Quitar
                      </Button>
                    </div>
                    {f.resultado.excluida ? (
                      <p className="mt-1 text-amber-600">Estado distinto de Entregado: no se importará.</p>
                    ) : null}
                    {f.resultado.errores.length > 0 ? (
                      <p className="mt-1 text-destructive">Errores: {f.resultado.errores.join(" · ")}</p>
                    ) : null}
                    {f.resultado.advertencias.length > 0 ? (
                      <p className="mt-1 text-amber-600">
                        Advertencias: {f.resultado.advertencias.join(" · ")}
                      </p>
                    ) : null}
                    {!f.resultado.excluida && f.resultado.errores.length === 0 ? (
                      <p className="mt-1 text-primary-ink">Se insertará al confirmar.</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPaso(1)}>
              Cambiar período
            </Button>
            <Button onClick={() => setPaso(3)} disabled={!hayFilaInsertable}>
              Continuar a confirmar
            </Button>
          </div>
        </div>
      ) : null}

      {paso === 3 ? (
        resultadoFinal ? (
          <div className="space-y-3">
            <p className="text-sm text-primary-ink">
              Ingreso confirmado: {resultadoFinal.odtInsertadas} ODT insertadas,{" "}
              {resultadoFinal.novedadesGeneradas} novedades generadas.
              {resultadoFinal.prefacturasCreadas !== undefined
                ? ` Prefacturas: ${resultadoFinal.prefacturasCreadas} nuevas, ${resultadoFinal.prefacturasActualizadas} actualizadas.`
                : ' No se pudo actualizar la prefactura del período automáticamente; usa "Generar prefacturas del período" en Prefacturas.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={ingresarOtra}>
                Ingresar otra ODT
              </Button>
              <Button variant="outline" asChild>
                <Link href="/importar">Volver a Importar</Link>
              </Button>
              <Button asChild>
                <Link href={`/prefacturas?periodo=${periodoId}`}>Ver en Prefacturas</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se insertarán las ODT válidas de la lista y se actualizará la prefactura del período. Si algo
              falla a mitad de camino, lo ya insertado queda guardado — vuelve a darle &quot;Confirmar&quot;
              (es seguro, no duplica nada).
            </p>
            {confirmando ? (
              <p className="text-sm text-muted-foreground">
                Confirmando... {progreso} ODT insertadas hasta ahora.
              </p>
            ) : null}
            {errorConfirmar ? <p className="text-sm text-destructive">{errorConfirmar}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPaso(2)} disabled={confirmando}>
                Volver a la lista
              </Button>
              <Button onClick={confirmar} disabled={confirmando}>
                {confirmando ? "Confirmando..." : "Confirmar e ingresar"}
              </Button>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = "text",
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  tipo?: "text" | "date" | "number";
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-muted-foreground">{etiqueta}</span>
      <Input type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
