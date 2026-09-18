import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { generarYGuardarPdf } from "@/pdf/generar-y-guardar";

export const runtime = "nodejs";

/** Genera (o regenera con nueva versión) el PDF de una prefactura. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const { id } = await params;

  const resultado = await generarYGuardarPdf(id, perfil.userId);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, documentoId: resultado.documentoId });
}

/** URL firmada de descarga del PDF vigente. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { id } = await params;

  const supabase = await createClient();
  const { data: documento } = await supabase
    .from("documento_pdf")
    .select("storage_key, nombre_archivo")
    .eq("prefactura_id", id)
    .eq("estado", "VIGENTE")
    .maybeSingle();

  if (!documento) {
    return NextResponse.json({ error: "Esta prefactura todavía no tiene PDF generado." }, { status: 404 });
  }

  const { data: firmada, error } = await supabase.storage
    .from("prefacturas")
    .createSignedUrl(documento.storage_key, 300, { download: documento.nombre_archivo });
  if (error || !firmada) {
    return NextResponse.json({ error: "No se pudo generar el enlace de descarga." }, { status: 500 });
  }

  return NextResponse.json({ url: firmada.signedUrl, nombreArchivo: documento.nombre_archivo });
}
