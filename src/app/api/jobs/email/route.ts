import { NextResponse } from "next/server";

import { defaultAppConfig } from "@/config/app.config";
import { obtenerEmailProvider } from "@/lib/email/provider";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Worker de la cola de correo. Lo dispara pg_cron cada minuto (ver
 * supabase/migrations/20260918090020_pg_cron_envio_correo.sql) y,
 * mientras el usuario tenga la pantalla de envío abierta, también el
 * frontend. Protegido con CRON_SECRET porque no hay sesión de usuario:
 * usa el cliente admin (service_role), nunca expuesto al navegador.
 */
export async function POST(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const autorizacion = request.headers.get("authorization");
  if (!secreto || autorizacion !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const tamanoLote = Number(process.env.EMAIL_BATCH_SIZE ?? defaultAppConfig.correo.tamanoLote);
  const ritmoPorMinuto = Number(process.env.EMAIL_RATE_PER_MINUTE ?? defaultAppConfig.correo.ritmoPorMinuto);
  const maxReintentos = Number(process.env.EMAIL_MAX_RETRIES ?? defaultAppConfig.correo.maxReintentos);
  const esperaEntreCorreosMs = Math.max(0, Math.ceil(60000 / Math.max(1, ritmoPorMinuto)));

  const { data: lote, error: errorLote } = await supabase.rpc("tomar_lote_envio_correo", {
    p_limite: tamanoLote,
  });
  if (errorLote) {
    return NextResponse.json({ error: errorLote.message }, { status: 500 });
  }
  if (!lote || lote.length === 0) {
    return NextResponse.json({ procesados: 0 });
  }

  const proveedor = obtenerEmailProvider();
  let exitosos = 0;
  let fallidos = 0;

  for (let i = 0; i < lote.length; i++) {
    const envio = lote[i]!;
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, esperaEntreCorreosMs));

    let adjuntos;
    if (envio.documento_pdf_id) {
      const { data: doc } = await supabase
        .from("documento_pdf")
        .select("storage_key, nombre_archivo")
        .eq("id", envio.documento_pdf_id)
        .maybeSingle();
      if (doc) {
        const { data: blob } = await supabase.storage.from("prefacturas").download(doc.storage_key);
        if (blob) {
          adjuntos = [
            {
              nombreArchivo: doc.nombre_archivo,
              contenido: Buffer.from(await blob.arrayBuffer()),
              contentType: "application/pdf",
            },
          ];
        }
      }
    }

    const resultado = await proveedor.enviar({
      to: envio.destinatarios_to as unknown as string[],
      cc: envio.destinatarios_cc as unknown as string[],
      asunto: envio.asunto,
      cuerpo: envio.cuerpo ?? "",
      adjuntos,
    });

    if (resultado.ok) {
      exitosos++;
      await supabase
        .from("envio_correo")
        .update({
          estado: "ENVIADO",
          message_id: resultado.messageId,
          enviado_en: new Date().toISOString(),
          error: null,
        })
        .eq("id", envio.id);
      await supabase.from("prefactura").update({ estado: "ENVIADA" }).eq("id", envio.prefactura_id);
    } else {
      const intentos = envio.intentos + 1;
      const agotado = resultado.permanente || intentos >= maxReintentos;
      fallidos++;
      await supabase
        .from("envio_correo")
        .update({
          estado: agotado ? "ERROR" : "REINTENTAR",
          intentos,
          error: resultado.error,
          proximo_intento: agotado ? null : new Date(Date.now() + 2 ** intentos * 60_000).toISOString(),
        })
        .eq("id", envio.id);
      if (agotado) {
        await supabase.from("prefactura").update({ estado: "ERROR_ENVIO" }).eq("id", envio.prefactura_id);
      }
    }

    if (envio.lote_id) {
      await supabase.rpc("incrementar_progreso_lote", {
        p_lote_id: envio.lote_id,
        p_exitoso: resultado.ok,
      });
    }
  }

  return NextResponse.json({ procesados: lote.length, exitosos, fallidos });
}
