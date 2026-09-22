import {
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  FileUp,
  Folder,
  History,
  IdCard,
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { cerrarSesionAction } from "@/lib/auth/actions";
import { obtenerPerfilActual } from "@/lib/auth/roles";

const MENU: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/buscador", label: "Buscador", icon: Search },
  { href: "/prefacturas", label: "Prefacturas", icon: Receipt },
  { href: "/importar", label: "Importar", icon: FileUp },
  { href: "/control-placa", label: "Control por placa", icon: IdCard },
  { href: "/validacion-odt", label: "Validación ODT / Escaneo", icon: ClipboardCheck },
  { href: "/transportistas", label: "Transportistas", icon: Users },
  { href: "/vehiculos", label: "Vehículos", icon: Truck },
  { href: "/repositorio", label: "Repositorio PDF", icon: Folder },
  { href: "/historial", label: "Historial / Log", icon: History },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/usuarios", label: "Usuarios", icon: UserCog },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col bg-laar-sidebar text-white">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 border-b border-white/10 px-6 py-5 transition-opacity hover:opacity-80"
        >
          <div className="h-2 w-2 rounded-full bg-laar-amarillo" />
          <span className="font-brand text-lg font-bold tracking-wide">LAARCOURIER</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {MENU.map((item) => {
            const Icono = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-laar-amarillo"
              >
                <Icono className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </Link>
            );
          })}
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
