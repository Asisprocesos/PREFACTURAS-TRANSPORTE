"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { importarMaestrosAction, type ResultadoImportarMaestros } from "@/lib/maestros/importar-actions";

export function FormularioImportarMaestros() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportarMaestros | null>(null);

  async function subir() {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const r = await importarMaestrosAction(formData);
      if (!r.ok) {
        setError(r.error ?? "No se pudo procesar el archivo.");
        return;
      }
      setResultado(r);
      setArchivo(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("Se perdió la conexión con el servidor mientras se procesaba el archivo.");
    } finally {
      setCargando(false);
    }
  }

  const filas = resultado?.filas ?? [];
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

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
        <div>
          <Button onClick={subir} disabled={!archivo || cargando}>
            {cargando ? "Procesando..." : "Subir y cargar"}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {resultado ? (
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
                                : "text-primary"
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
