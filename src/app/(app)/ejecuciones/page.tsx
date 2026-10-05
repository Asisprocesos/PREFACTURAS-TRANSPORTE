import { requireRole } from "@/lib/auth/roles";
import { listarEjecuciones } from "@/lib/ejecuciones/queries";
import type { EstadoLoteProceso, TipoLoteProceso } from "@/types/database.types";

import { FiltrosEjecuciones } from "./filtros";
import { TablaEjecuciones } from "./tabla";

const TAMANO_PAGINA = 20;

export default async function EjecucionesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tipo?: string; estado?: string }>;
}) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);

  const { filas, total } = await listarEjecuciones({
    pagina,
    tamanoPagina: TAMANO_PAGINA,
    tipo: params.tipo as TipoLoteProceso | undefined,
    estado: params.estado as EstadoLoteProceso | undefined,
  });

  const puedeCancelar = perfil.rol === "ADMIN" || perfil.rol === "OPERADOR_TRANSPORTE";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Ejecuciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generación de PDF masiva, envíos de correo y cargas masivas que corren en segundo plano. Si una
          quedó a medias (por ejemplo, porque cambiaste de pantalla), acá puedes verla, cancelarla o — para
          PDF y cargas masivas — volver a la pantalla de origen y seguir desde donde quedó.
        </p>
      </div>
      <FiltrosEjecuciones />
      <TablaEjecuciones
        filas={filas}
        total={total}
        pagina={pagina}
        tamanoPagina={TAMANO_PAGINA}
        puedeCancelar={puedeCancelar}
      />
    </div>
  );
}
