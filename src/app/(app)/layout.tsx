import Link from "next/link";

import { cerrarSesionAction } from "@/lib/auth/actions";
import { obtenerPerfilActual } from "@/lib/auth/roles";

const MENU = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/buscador", label: "Buscador" },
  { href: "/prefacturas", label: "Prefacturas" },
  { href: "/importar", label: "Importar" },
  { href: "/control-placa", label: "Control por placa" },
  { href: "/validacion-odt", label: "Validación ODT / Escaneo" },
  { href: "/transportistas", label: "Transportistas" },
  { href: "/vehiculos", label: "Vehículos" },
  { href: "/repositorio", label: "Repositorio PDF" },
  { href: "/historial", label: "Historial / Log" },
  { href: "/reportes", label: "Reportes" },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/configuracion", label: "Configuración" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col bg-laar-sidebar text-white">
        <div className="flex items-center gap-2 border-b border-white/10 px-6 py-5">
          <div className="h-2 w-2 rounded-full bg-laar-amarillo" />
          <span className="font-brand text-lg font-bold tracking-wide">LAARCOURIER</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-laar-amarillo"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 px-3 py-4">
          {perfil ? (
            <p className="truncate px-3 pb-2 text-xs text-white/50" title={perfil.email ?? undefined}>
              {perfil.nombre || perfil.email}
            </p>
          ) : null}
          <form action={cerrarSesionAction}>
            <button
              type="submit"
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-laar-amarillo"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 bg-laar-gris/30">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
