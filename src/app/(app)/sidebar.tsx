"use client";

import {
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  FileUp,
  Folder,
  History,
  IdCard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ScrollText,
  Search,
  Settings,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { cerrarSesionAction } from "@/lib/auth/actions";
import type { AlertasGlobales } from "@/lib/alertas/queries";
import { cn } from "@/lib/utils";
import type { RolUsuario } from "@/types/database.types";

const TODOS_LOS_ROLES: RolUsuario[] = ["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"];
const SIN_CONSULTA: RolUsuario[] = ["ADMIN", "OPERADOR_TRANSPORTE"];
const SOLO_ADMIN: RolUsuario[] = ["ADMIN"];

/**
 * `alerta` mapea el href a la clave de AlertasGlobales cuyo conteo se
 * muestra como badge (ninguna = sin badge). `roles` son los roles que ven
 * el ítem — debe reflejar el `requireRole` del page.tsx de destino, para no
 * mostrar un enlace que el usuario no puede abrir (rebote a /no-autorizado).
 */
const MENU: {
  href: string;
  label: string;
  icon: LucideIcon;
  alerta?: keyof AlertasGlobales;
  roles: RolUsuario[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: TODOS_LOS_ROLES },
  { href: "/buscador", label: "Buscador", icon: Search, roles: TODOS_LOS_ROLES },
  {
    href: "/prefacturas",
    label: "Prefacturas",
    icon: Receipt,
    alerta: "prefacturasErrorEnvio",
    roles: TODOS_LOS_ROLES,
  },
  // El wizard de /importar es de ADMIN/OPERADOR_TRANSPORTE; CONSULTA solo
  // puede ver el detalle de una importación ya hecha (/importar/[id]), a
  // la que no hay enlace directo desde el menú.
  { href: "/importar", label: "Importar", icon: FileUp, roles: SIN_CONSULTA },
  {
    href: "/control-placa",
    label: "Control por placa",
    icon: IdCard,
    alerta: "novedadesError",
    roles: TODOS_LOS_ROLES,
  },
  {
    href: "/validacion-odt",
    label: "Validación ODT / Escaneo",
    icon: ClipboardCheck,
    roles: TODOS_LOS_ROLES,
  },
  { href: "/transportistas", label: "Transportistas", icon: Users, roles: TODOS_LOS_ROLES },
  { href: "/vehiculos", label: "Vehículos", icon: Truck, roles: TODOS_LOS_ROLES },
  { href: "/repositorio", label: "Repositorio PDF", icon: Folder, roles: TODOS_LOS_ROLES },
  { href: "/historial", label: "Historial / Log", icon: History, roles: TODOS_LOS_ROLES },
  { href: "/ejecuciones", label: "Ejecuciones", icon: ListChecks, roles: TODOS_LOS_ROLES },
  { href: "/reportes", label: "Reportes", icon: BarChart3, roles: TODOS_LOS_ROLES },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, roles: SOLO_ADMIN },
  { href: "/auditoria", label: "Historial de cambios", icon: ScrollText, roles: SOLO_ADMIN },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: SOLO_ADMIN },
];

const CLAVE_COLAPSADO = "laar_sidebar_colapsada";

export function Sidebar({
  perfil,
  cerrarSesion,
  alertas,
}: {
  perfil: { nombre: string | null; email: string | null; rol: RolUsuario } | null;
  cerrarSesion: typeof cerrarSesionAction;
  alertas: AlertasGlobales | null;
}) {
  // Arranca expandida en el server y en el primer render del cliente (para
  // que coincidan y no haya warning de hidratación); el useEffect de abajo
  // aplica la preferencia guardada apenas monta, antes de que el usuario
  // llegue a notarlo.
  const [colapsada, setColapsada] = useState(false);

  useEffect(() => {
    try {
      setColapsada(localStorage.getItem(CLAVE_COLAPSADO) === "1");
    } catch {
      // Almacenamiento no disponible (ej. modo privado): se queda expandida.
    }
  }, []);

  function alternar() {
    setColapsada((actual) => {
      const nuevo = !actual;
      try {
        localStorage.setItem(CLAVE_COLAPSADO, nuevo ? "1" : "0");
      } catch {
        // Sin almacenamiento disponible, la preferencia solo dura la sesión.
      }
      return nuevo;
    });
  }

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col bg-laar-sidebar text-white transition-[width] duration-200",
        colapsada ? "w-16" : "w-64",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-5">
        <Link
          href="/dashboard"
          className={cn(
            "flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80",
            colapsada && "justify-center",
          )}
          title="LAARCOURIER — Ir al dashboard"
        >
          <div className="h-2 w-2 shrink-0 rounded-full bg-laar-amarillo" />
          {!colapsada ? (
            <span className="truncate font-brand text-lg font-bold tracking-wide">LAARCOURIER</span>
          ) : null}
        </Link>
        {!colapsada ? (
          <button
            type="button"
            onClick={alternar}
            title="Minimizar barra lateral"
            className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-laar-amarillo"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {colapsada ? (
        <button
          type="button"
          onClick={alternar}
          title="Expandir barra lateral"
          className="mx-auto mt-2 rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-laar-amarillo"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      ) : null}

      <nav className="flex-1 space-y-1 px-3 py-4">
        {MENU.filter((item) => perfil && item.roles.includes(perfil.rol)).map((item) => {
          const Icono = item.icon;
          const conteo = item.alerta && alertas ? alertas[item.alerta] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={
                colapsada ? (conteo > 0 ? `${item.label} (${conteo} pendiente(s))` : item.label) : undefined
              }
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-laar-amarillo",
                colapsada && "justify-center px-2",
              )}
            >
              <span className="relative shrink-0">
                <Icono className="h-4 w-4" />
                {conteo > 0 && colapsada ? (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                ) : null}
              </span>
              {!colapsada ? (
                <>
                  <span className="flex-1">{item.label}</span>
                  {conteo > 0 ? (
                    <span className="rounded-full bg-destructive px-1.5 py-0.5 text-xs font-semibold leading-none text-destructive-foreground">
                      {conteo > 99 ? "99+" : conteo}
                    </span>
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                  )}
                </>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        {perfil && !colapsada ? (
          <p className="truncate px-3 pb-2 text-xs text-white/50" title={perfil.email ?? undefined}>
            {perfil.nombre || perfil.email}
          </p>
        ) : null}
        <form action={cerrarSesion}>
          <button
            type="submit"
            title={colapsada ? "Cerrar sesión" : undefined}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-laar-amarillo",
              colapsada && "justify-center px-2",
            )}
          >
            {colapsada ? <LogOut className="h-4 w-4 shrink-0" /> : null}
            {!colapsada ? "Cerrar sesión" : null}
          </button>
        </form>
      </div>
    </aside>
  );
}
