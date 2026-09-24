import { requireRole } from "@/lib/auth/roles";
import { listarPeriodosParaSelect } from "@/lib/importador/queries";
import { listarDocumentos } from "@/lib/repositorio/queries";
import { listarTransportistasParaSelect } from "@/lib/vehiculos/queries";
import type { EstadoDocumentoPdf } from "@/types/database.types";

import { FiltrosRepositorio } from "./filtros";
import { TablaDocumentos } from "./tabla-documentos";

const TAMANO_PAGINA = 20;

export default async function RepositorioPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    periodo?: string;
    transportista?: string;
    placa?: string;
    numero?: string;
    estado?: string;
    anio?: string;
    mes?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.page ?? "1") || 1);

  const [periodos, transportistas] = await Promise.all([
    listarPeriodosParaSelect(),
    listarTransportistasParaSelect(),
  ]);

  const { filas, total } = await listarDocumentos({
    pagina,
    tamanoPagina: TAMANO_PAGINA,
    periodoId: params.periodo,
    transportistaId: params.transportista,
    placa: params.placa,
    numero: params.numero,
    estadoDocumento: params.estado as EstadoDocumentoPdf | undefined,
    anio: params.anio,
    mes: params.mes,
    desde: params.desde,
    hasta: params.hasta,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Repositorio de Prefacturas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La fuente de verdad es la tabla <code>documento_pdf</code>, no la carpeta de Storage.
        </p>
      </div>
      <FiltrosRepositorio periodos={periodos} transportistas={transportistas} />
      <TablaDocumentos
        filas={filas}
        total={total}
        pagina={pagina}
        tamanoPagina={TAMANO_PAGINA}
        puedeEliminar={perfil.rol === "ADMIN"}
      />
    </div>
  );
}
