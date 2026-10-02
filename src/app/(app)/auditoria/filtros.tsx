"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUSQUEDA_POR_TABLA, TABLAS_AUDITADAS, etiquetaAccion } from "@/lib/auditoria/display";
import type { UsuarioConPerfil } from "@/lib/usuarios/queries";

const ACCIONES = ["INSERT", "UPDATE", "DELETE"] as const;

export function FiltrosAuditoria({ usuarios }: { usuarios: UsuarioConPerfil[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tablaSeleccionada = searchParams.get("tabla") ?? "";
  const busquedaDinamica = BUSQUEDA_POR_TABLA[tablaSeleccionada];

  function actualizar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    params.set("page", "1");
    router.push(`/auditoria?${params.toString()}`);
  }

  function cambiarTabla(valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set("tabla", valor);
    else params.delete("tabla");
    // El buscador de texto es específico de cada módulo (guía para ODT,
    // número para prefactura, etc.) — al cambiar de módulo el término ya
    // escrito deja de tener sentido, así que se limpia junto con el cambio.
    params.delete("q");
    params.set("page", "1");
    router.push(`/auditoria?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="desde">Desde</Label>
        <Input
          id="desde"
          type="date"
          defaultValue={searchParams.get("desde") ?? ""}
          onChange={(e) => actualizar("desde", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="hasta">Hasta</Label>
        <Input
          id="hasta"
          type="date"
          defaultValue={searchParams.get("hasta") ?? ""}
          onChange={(e) => actualizar("hasta", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="usuario">Usuario</Label>
        <select
          id="usuario"
          value={searchParams.get("usuario") ?? ""}
          onChange={(e) => actualizar("usuario", e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos los usuarios</option>
          {usuarios.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.nombre || u.email}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tabla">Módulo</Label>
        <select
          id="tabla"
          value={tablaSeleccionada}
          onChange={(e) => cambiarTabla(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos los módulos</option>
          {TABLAS_AUDITADAS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </div>
      {busquedaDinamica ? (
        <div className="space-y-1">
          <Label htmlFor="q">
            Buscar en {TABLAS_AUDITADAS.find((t) => t.valor === tablaSeleccionada)?.etiqueta}
          </Label>
          <Input
            id="q"
            key={tablaSeleccionada}
            defaultValue={searchParams.get("q") ?? ""}
            onBlur={(e) => actualizar("q", e.target.value)}
            placeholder={busquedaDinamica.etiqueta}
            autoComplete="off"
            className="w-64"
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="accion">Tipo de cambio</Label>
        <select
          id="accion"
          value={searchParams.get("accion") ?? ""}
          onChange={(e) => actualizar("accion", e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          {ACCIONES.map((a) => (
            <option key={a} value={a}>
              {etiquetaAccion(a)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
