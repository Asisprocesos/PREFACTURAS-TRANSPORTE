"use client";

import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cambiarActivoUsuario, cambiarRolUsuario, type EstadoAccionUsuario } from "@/lib/usuarios/actions";
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
  const [estadoActivo, formActionActivo] = useActionState(cambiarActivoUsuario, estadoInicial);
  const formRolRef = useRef<HTMLFormElement>(null);

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
        <form action={formActionActivo} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={usuario.userId} />
          <input type="hidden" name="activo" value={(!usuario.activo).toString()} />
          <Button type="submit" variant={usuario.activo ? "outline" : "destructive"} size="sm">
            {usuario.activo ? "Activo" : "Inactivo"}
          </Button>
          {estadoActivo.error ? <span className="text-xs text-destructive">{estadoActivo.error}</span> : null}
        </form>
      </td>
    </tr>
  );
}
