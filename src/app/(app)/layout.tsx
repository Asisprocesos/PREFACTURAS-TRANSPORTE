import { cerrarSesionAction } from "@/lib/auth/actions";
import { obtenerPerfilActual } from "@/lib/auth/roles";
import { obtenerAlertasGlobales } from "@/lib/alertas/queries";

import { Sidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();
  // Sin sesión no hay nada que mostrar en el sidebar aparte del login: se
  // evita la consulta en ese caso (cada page.tsx redirige con requireRole).
  const alertas = perfil ? await obtenerAlertasGlobales() : null;

  return (
    <div className="flex min-h-screen">
      <Sidebar perfil={perfil} cerrarSesion={cerrarSesionAction} alertas={alertas} />
      <div className="flex-1 bg-laar-gris/30">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
