import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { generarYGuardarPdf } from "@/pdf/generar-y-guardar";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Genera (o regenera con nueva versión) el PDF de una prefactura. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const { id } = await params;

  try {
    const resultado = await generarYGuardarPdf(id, perfil.userId);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: 422 });
    }
    return NextResponse.json({ ok: true, documentoId: resultado.documentoId });
  } catch (error) {
    // Sin este try/catch, cualquier excepción no controlada (ej. un error
    // real de @react-pdf/renderer) devuelve un 500 sin cuerpo JSON y el
    // botón solo puede mostrar "HTTP 500" — con esto el mensaje real llega
    // al operador y queda igual en los logs de Vercel.
    console.error("Error generando PDF de prefactura", id, error);
    const mensaje = error instanceof Error ? error.message : "Error desconocido generando el PDF.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

/** URL firmada de descarga del PDF vigente. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { id } = await params;

  try {
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
      return NextResponse.json(
        { error: error?.message ?? "No se pudo generar el enlace de descarga." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: firmada.signedUrl, nombreArchivo: documento.nombre_archivo });
  } catch (error) {
    console.error("Error obteniendo el PDF de prefactura", id, error);
    const mensaje = error instanceof Error ? error.message : "Error desconocido obteniendo el PDF.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
