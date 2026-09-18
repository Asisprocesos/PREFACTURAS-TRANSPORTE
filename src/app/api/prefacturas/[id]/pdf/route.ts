import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { generarBufferPdf, nombreArchivoPdf, validarPrefacturaParaPdf } from "@/pdf/generar";

export const runtime = "nodejs";

/** Genera (o regenera con nueva versión) el PDF de una prefactura. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const { id } = await params;

  const validacion = await validarPrefacturaParaPdf(id);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.motivo }, { status: 422 });
  }
  const { prefactura } = validacion;

  const supabase = await createClient();
  const { count: novedadesError } = await supabase
    .from("novedad")
    .select("id", { count: "exact", head: true })
    .eq("placa", prefactura.vehiculo?.placa ?? "")
    .eq("periodo_id", prefactura.periodo_id)
    .eq("severidad", "ERROR")
    .eq("estado", "ABIERTA");
  if ((novedadesError ?? 0) > 0) {
    return NextResponse.json(
      { error: "La placa tiene novedades de severidad ERROR abiertas. Resuélvelas antes de generar el PDF." },
      { status: 422 },
    );
  }

  const buffer = await generarBufferPdf(prefactura);
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const version = prefactura.version_actual + 1;

  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const ruc = prefactura.transportista!.ruc;
  const storageKey = `prefacturas/${anio}/${mes}/${ruc}/${prefactura.numero}_v${version}.pdf`;

  const { error: errorSubida } = await supabase.storage
    .from("prefacturas")
    .upload(storageKey, buffer, { contentType: "application/pdf", upsert: true });
  if (errorSubida) {
    return NextResponse.json({ error: `No se pudo guardar el PDF: ${errorSubida.message}` }, { status: 500 });
  }

  await supabase
    .from("documento_pdf")
    .update({ estado: "REEMPLAZADO" })
    .eq("prefactura_id", id)
    .eq("estado", "VIGENTE");

  const { data: documento, error: errorDoc } = await supabase
    .from("documento_pdf")
    .insert({
      prefactura_id: id,
      nombre_archivo: nombreArchivoPdf(prefactura.vehiculo?.placa ?? "", ruc),
      storage_key: storageKey,
      version,
      tamano_bytes: buffer.length,
      checksum,
      generado_por: perfil.userId,
      estado: "VIGENTE",
    })
    .select("id")
    .single();
  if (errorDoc || !documento) {
    return NextResponse.json({ error: "No se pudo registrar el documento generado." }, { status: 500 });
  }

  await supabase.from("prefactura").update({ estado: "PDF_GENERADO", version_actual: version }).eq("id", id);

  return NextResponse.json({ ok: true, documentoId: documento.id, version });
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
