import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, EstadoDocumentoPdf } from "@/types/database.types";

export type DocumentoPdf = Database["public"]["Tables"]["documento_pdf"]["Row"];

export interface DocumentoConRelaciones extends DocumentoPdf {
  prefactura: {
    id: string;
    numero: string | null;
    estado: string;
    vehiculo: { placa: string } | null;
    transportista: { razon_social: string; ruc: string } | null;
    periodo: { id: string; nombre: string } | null;
  } | null;
}

export interface FiltrosRepositorio {
  anio?: string;
  mes?: string;
  periodoId?: string;
  transportistaId?: string;
  placa?: string;
  numero?: string;
  estadoDocumento?: EstadoDocumentoPdf;
  desde?: string;
  hasta?: string;
}

export interface ListarDocumentosParams extends FiltrosRepositorio {
  pagina: number;
  tamanoPagina: number;
}

/**
 * `documento_pdf` no tiene columnas directas de placa/transportista/período
 * (esos viven en `prefactura`), así que los filtros que dependen de ellos
 * se resuelven primero contra `prefactura` y luego se filtra `documento_pdf`
 * por `prefactura_id IN (...)`. Documentado porque no es obvio a partir de
 * la firma de la función.
 */
export async function listarDocumentos({
  pagina,
  tamanoPagina,
  anio,
  mes,
  periodoId,
  transportistaId,
  placa,
  numero,
  estadoDocumento,
  desde,
  hasta,
}: ListarDocumentosParams): Promise<{ filas: DocumentoConRelaciones[]; total: number }> {
  const supabase = await createClient();
  const desdeIdx = (pagina - 1) * tamanoPagina;
  const hastaIdx = desdeIdx + tamanoPagina - 1;

  let prefacturaIds: string[] | null = null;
  const necesitaFiltroPrefactura = periodoId || transportistaId || placa || numero;

  if (necesitaFiltroPrefactura) {
    let filtroPrefactura = supabase.from("prefactura").select("id, vehiculo:vehiculo_id(placa)");
    if (periodoId) filtroPrefactura = filtroPrefactura.eq("periodo_id", periodoId);
    if (transportistaId) filtroPrefactura = filtroPrefactura.eq("transportista_id", transportistaId);
    if (numero) filtroPrefactura = filtroPrefactura.ilike("numero", `%${numero}%`);
    const { data } = await filtroPrefactura;
    let filtradas = data ?? [];
    if (placa) {
      const placaNorm = placa.toUpperCase().replace(/[-\s]/g, "");
      filtradas = filtradas.filter((p) =>
        (p as unknown as { vehiculo: { placa: string } | null }).vehiculo?.placa.includes(placaNorm),
      );
    }
    prefacturaIds = filtradas.map((p) => p.id);
    if (prefacturaIds.length === 0) return { filas: [], total: 0 };
  }

  let query = supabase
    .from("documento_pdf")
    .select(
      "*, prefactura:prefactura_id(id, numero, estado, vehiculo:vehiculo_id(placa), transportista:transportista_id(razon_social, ruc), periodo:periodo_id(id, nombre))",
      { count: "exact" },
    )
    .order("generado_en", { ascending: false })
    .range(desdeIdx, hastaIdx);

  if (prefacturaIds) query = query.in("prefactura_id", prefacturaIds);
  if (estadoDocumento) query = query.eq("estado", estadoDocumento);
  if (anio) query = query.gte("generado_en", `${anio}-01-01`).lt("generado_en", `${Number(anio) + 1}-01-01`);
  if (mes && anio) {
    const mesStr = mes.padStart(2, "0");
    const siguienteMes =
      Number(mes) === 12
        ? `${Number(anio) + 1}-01-01`
        : `${anio}-${String(Number(mes) + 1).padStart(2, "0")}-01`;
    query = query.gte("generado_en", `${anio}-${mesStr}-01`).lt("generado_en", siguienteMes);
  }
  if (desde) query = query.gte("generado_en", desde);
  if (hasta) query = query.lte("generado_en", hasta);

  const { data, error, count } = await query;
  if (error) throw error;
  return { filas: (data ?? []) as unknown as DocumentoConRelaciones[], total: count ?? 0 };
}

export async function listarVersionesPrefactura(prefacturaId: string): Promise<DocumentoPdf[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documento_pdf")
    .select("*")
    .eq("prefactura_id", prefacturaId)
    .order("version", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
