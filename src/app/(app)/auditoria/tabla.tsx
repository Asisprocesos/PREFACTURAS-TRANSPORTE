"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";

import { Paginacion } from "@/components/ui/paginacion";
import { camposCambiados, descripcionRegistro, etiquetaAccion, etiquetaTabla } from "@/lib/auditoria/display";
import type { EntradaAuditoria } from "@/lib/auditoria/queries";

const ESTILO_ACCION: Record<string, string> = {
  INSERT: "bg-primary/20 text-foreground",
  UPDATE: "bg-yellow-100 text-yellow-800",
  DELETE: "bg-destructive/10 text-destructive",
};

const formatoFecha = new Intl.DateTimeFormat("es-EC", { dateStyle: "short", timeStyle: "short" });

function formatearValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function TablaAuditoria({
  filas,
  total,
  pagina,
  tamanoPagina,
}: {
  filas: EntradaAuditoria[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));

  function irAPagina(nuevaPagina: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nuevaPagina));
    router.push(`/auditoria?${params.toString()}`);
  }

  function alternar(id: string) {
    setExpandidas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-3" />
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Cambio</th>
              <th className="px-4 py-3 font-medium">Módulo</th>
              <th className="px-4 py-3 font-medium">Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Sin registros con estos filtros.
                </td>
              </tr>
            ) : (
              filas.map((f) => {
                const { titulo, href } = descripcionRegistro(f);
                const cambios = camposCambiados(f);
                const abierta = expandidas.has(f.id);
                return (
                  <Fragment key={f.id}>
                    <tr className="cursor-pointer hover:bg-muted/30" onClick={() => alternar(f.id)}>
                      <td className="px-2 py-3 text-muted-foreground">
                        {abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatoFecha.format(new Date(f.fecha))}
                      </td>
                      <td className="px-4 py-3">{f.usuarioNombre || f.usuarioEmail || "Sistema"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_ACCION[f.accion] ?? ""}`}
                        >
                          {etiquetaAccion(f.accion)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{etiquetaTabla(f.tabla)}</td>
                      <td className="px-4 py-3">
                        {href ? (
                          <Link
                            href={href}
                            className="font-medium text-primary-ink hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {titulo}
                          </Link>
                        ) : (
                          titulo
                        )}
                      </td>
                    </tr>
                    {abierta ? (
                      <tr>
                        <td colSpan={6} className="bg-muted/20 px-4 py-3">
                          {cambios.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin campos para mostrar.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead className="text-left text-muted-foreground">
                                <tr>
                                  <th className="py-1 pr-4 font-medium">Campo</th>
                                  {f.accion === "UPDATE" ? (
                                    <th className="py-1 pr-4 font-medium">Antes</th>
                                  ) : null}
                                  <th className="py-1 font-medium">
                                    {f.accion === "DELETE"
                                      ? "Valor"
                                      : f.accion === "UPDATE"
                                        ? "Después"
                                        : "Valor"}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {cambios.map((c) => (
                                  <tr key={c.campo}>
                                    <td className="py-1 pr-4 font-medium">{c.campo}</td>
                                    {f.accion === "UPDATE" ? (
                                      <td className="py-1 pr-4 text-muted-foreground">
                                        {formatearValor(c.anterior)}
                                      </td>
                                    ) : null}
                                    <td className="py-1">
                                      {formatearValor(f.accion === "DELETE" ? c.anterior : c.nuevo)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
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
        <span>{total} registros</span>
        <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiarPagina={irAPagina} />
      </div>
    </div>
  );
}
