import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/roles";
import { listarEnviosLote, obtenerLoteProceso } from "@/lib/correo/queries";

import { ProgresoLote } from "./progreso-lote";

export default async function LoteEnvioPage({ params }: { params: Promise<{ loteId: string }> }) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { loteId } = await params;

  const lote = await obtenerLoteProceso(loteId);
  if (!lote) notFound();

  const envios = await listarEnviosLote(loteId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-marca text-2xl">Progreso del envío masivo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El worker <code>/api/jobs/email</code> procesa la cola cada minuto (pg_cron). Esta pantalla se
          actualiza en tiempo real vía Supabase Realtime.
        </p>
      </div>
      <ProgresoLote lote={lote} enviosIniciales={envios} />
    </div>
  );
}
