"use client";

import { useActionState, useRef } from "react";

import {
  cambiarEstadoUsuarioAction,
  cambiarRolUsuario,
  type EstadoAccionUsuario,
} from "@/lib/usuarios/actions";
import type { UsuarioConPerfil } from "@/lib/usuarios/queries";

const ROLES = ["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"] as const;

const estadoInicial: EstadoAccionUsuario = {};

export function UsuariosTable({ usuarios }: { usuarios: UsuarioConPerfil[] }) {
  if (usuarios.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay usuarios registrados todavía.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Correo</th>
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Rol</th>
            <th className="px-4 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {usuarios.map((u) => (
            <FilaUsuario key={u.userId} usuario={u} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaUsuario({ usuario }: { usuario: UsuarioConPerfil }) {
  const [, formActionRol] = useActionState(cambiarRolUsuario, estadoInicial);
  const [estadoEstado, formActionEstado] = useActionState(cambiarEstadoUsuarioAction, estadoInicial);
  const formRolRef = useRef<HTMLFormElement>(null);
  const formEstadoRef = useRef<HTMLFormElement>(null);

  function manejarCambioEstado(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === "ELIMINAR") {
      const confirmado = confirm(
        `¿Eliminar a ${usuario.email}? Esta acción no se puede deshacer. Si ya tiene actividad registrada en el sistema, no se podrá eliminar — desactívalo en ese caso.`,
      );
      if (!confirmado) {
        e.target.value = usuario.activo ? "ACTIVO" : "INACTIVO";
        return;
      }
    }
    formEstadoRef.current?.requestSubmit();
  }

  return (
    <tr>
      <td className="px-4 py-3">{usuario.email ?? "—"}</td>
      <td className="px-4 py-3">{usuario.nombre ?? "—"}</td>
      <td className="px-4 py-3">
        <form ref={formRolRef} action={formActionRol}>
          <input type="hidden" name="userId" value={usuario.userId} />
          <select
            name="rol"
            defaultValue={usuario.rol}
            onChange={() => formRolRef.current?.requestSubmit()}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </form>
      </td>
      <td className="px-4 py-3">
        <form ref={formEstadoRef} action={formActionEstado} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={usuario.userId} />
          <select
            name="estado"
            defaultValue={usuario.activo ? "ACTIVO" : "INACTIVO"}
            onChange={manejarCambioEstado}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="ELIMINAR">Eliminar</option>
          </select>
          {estadoEstado.error ? <span className="text-xs text-destructive">{estadoEstado.error}</span> : null}
        </form>
      </td>
    </tr>
  );
}
