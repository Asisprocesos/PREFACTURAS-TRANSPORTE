import { cerrarSesionAction } from "@/lib/auth/actions";
import { obtenerPerfilActual } from "@/lib/auth/roles";

import { Sidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();

  return (
    <div className="flex min-h-screen">
      <Sidebar perfil={perfil} cerrarSesion={cerrarSesionAction} />
      <div className="flex-1 bg-laar-gris/30">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
