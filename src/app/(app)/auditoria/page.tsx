import { requireRole } from "@/lib/auth/roles";
import { listarAuditoria } from "@/lib/auditoria/queries";
import { listarUsuarios } from "@/lib/usuarios/queries";

import { FiltrosAuditoria } from "./filtros";
import { TablaAuditoria } from "./tabla";

const TAMANO_PAGINA = 30;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    desde?: string;
    hasta?: string;
    usuario?: string;
    tabla?: string;
    accion?: string;
  }>;
}) {
  // Historial de cambios: solo ADMIN. No es un simple ocultamiento del menú
  // (ver sidebar.tsx) — entrar por URL directa también debe rebotar.
  await requireRole(["ADMIN"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);

  const [usuarios, { filas, total }] = await Promise.all([
    listarUsuarios(),
    listarAuditoria({
      pagina,
      tamanoPagina: TAMANO_PAGINA,
      desde: params.desde ? `${params.desde}T00:00:00.000Z` : undefined,
      hasta: params.hasta ? `${params.hasta}T23:59:59.999Z` : undefined,
      usuarioId: params.usuario,
      tabla: params.tabla,
      accion: params.accion,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Historial de cambios</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quién hizo qué cambio, cuándo y en qué registro — creación, modificación y eliminación en los
          módulos principales del sistema.
        </p>
      </div>
      <FiltrosAuditoria usuarios={usuarios} />
      <TablaAuditoria filas={filas} total={total} pagina={pagina} tamanoPagina={TAMANO_PAGINA} />
    </div>
  );
}
