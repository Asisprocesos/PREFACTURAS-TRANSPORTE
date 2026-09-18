import { requireRole } from "@/lib/auth/roles";
import { listarUsuarios } from "@/lib/usuarios/queries";

import { InvitarUsuarioForm } from "./invitar-usuario-form";
import { UsuariosTable } from "./usuarios-table";

export default async function UsuariosPage() {
  await requireRole(["ADMIN"]);
  const usuarios = await listarUsuarios();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Usuarios</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gestiona quién puede acceder al sistema y con qué rol: ADMIN (todo), OPERADOR_TRANSPORTE (importar,
          corregir, generar y enviar) o CONSULTA (ver y descargar).
        </p>
      </div>
      <InvitarUsuarioForm />
      <UsuariosTable usuarios={usuarios} />
    </div>
  );
}
