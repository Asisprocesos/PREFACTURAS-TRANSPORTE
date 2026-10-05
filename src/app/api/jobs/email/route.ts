import { NextResponse } from "next/server";

import { defaultAppConfig } from "@/config/app.config";
import { obtenerEmailProvider } from "@/lib/email/provider";
import { obtenerGuiasPrefactura, registrarLogEjecucion } from "@/lib/log-ejecucion/registrar";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// Márgen de seguridad bajo maxDuration: hay que dejar tiempo para que el
// envío en curso termine y la función devuelva respuesta antes de que
// Vercel la mate por timeout. Si eso pasara a mitad de un envío, esa fila
// quedaría en ENVIANDO sin que nadie la retome (ver limpieza de huérfanos
// más abajo) — mejor cortar el lote antes de llegar a ese límite.
const PRESUPUESTO_MS = 45_000;

/**
 * Worker de la cola de correo. Lo dispara pg_cron cada minuto (ver
 * supabase/migrations/20260918090020_pg_cron_envio_correo.sql) y,
 * mientras el usuario tenga la pantalla de envío abierta, también el
 * frontend. Protegido con CRON_SECRET porque no hay sesión de usuario:
 * usa el cliente admin (service_role), nunca expuesto al navegador.
 */
export async function POST(request: Request) {
  const inicio = Date.now();
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

  // Filas huérfanas: un tick anterior las marcó ENVIANDO (tomar_lote_envio_correo
  // lo hace de una para todo el lote reclamado, antes de procesar fila por
  // fila) y la función se cortó a mitad de camino — por timeout de Vercel o
  // por caerse el proceso — sin llegar a devolverlas a PENDIENTE. Nadie más
  // las reclama (tomar_lote_envio_correo solo toma PENDIENTE/REINTENTAR), así
  // que sin este barrido quedarían "enviando" para siempre. 3 minutos es
  // tiempo de sobra frente al PRESUPUESTO_MS de este mismo worker.
  await supabase
    .from("envio_correo")
    .update({ estado: "PENDIENTE" })
    .eq("estado", "ENVIANDO")
    .lt("updated_at", new Date(Date.now() - 3 * 60_000).toISOString());

  const { data: lote, error: errorLote } = await supabase.rpc("tomar_lote_envio_correo", {
    p_limite: tamanoLote,
  });
  if (errorLote) {
    return NextResponse.json({ error: errorLote.message }, { status: 500 });
  }
  if (!lote || lote.length === 0) {
    return NextResponse.json({ procesados: 0 });
  }

  // tomar_lote_envio_correo ya marcó estas filas como ENVIANDO (para que
  // ningún otro tick las vuelva a tomar). Si el proveedor no se puede
  // inicializar (ej. faltan las variables SMTP_*), hay que devolverlas a
  // PENDIENTE explícitamente — si no, quedan huérfanas en ENVIANDO para
  // siempre, porque tomar_lote_envio_correo solo reclama PENDIENTE/REINTENTAR.
  let proveedor;
  try {
    proveedor = await obtenerEmailProvider();
  } catch (error) {
    await supabase
      .from("envio_correo")
      .update({ estado: "PENDIENTE" })
      .in(
        "id",
        lote.map((e) => e.id),
      )
      .eq("estado", "ENVIANDO");
    const mensaje = error instanceof Error ? error.message : "No se pudo inicializar el proveedor de correo.";
    console.error("Error inicializando el proveedor de correo", mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }

  let exitosos = 0;
  let fallidos = 0;

  for (let i = 0; i < lote.length; i++) {
    // Un lote grande a un ritmo lento (ej. 20 correos a 10/min = 6s entre
    // cada uno = ~114s) puede no alcanzar a terminar dentro de maxDuration.
    // En vez de dejar que Vercel mate la función a mitad de un envío (la
    // fila en curso quedaría en ENVIANDO huérfana), se corta antes: lo ya
    // procesado queda guardado, y el resto del lote reclamado vuelve a
    // PENDIENTE para que el próximo tick (máx. 1 minuto después) lo retome.
    if (i > 0 && Date.now() - inicio > PRESUPUESTO_MS) {
      await supabase
        .from("envio_correo")
        .update({ estado: "PENDIENTE" })
        .in(
          "id",
          lote.slice(i).map((e) => e.id),
        )
        .eq("estado", "ENVIANDO");
      return NextResponse.json({ procesados: i, exitosos, fallidos, cortado: true });
    }

    const envio = lote[i]!;
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, esperaEntreCorreosMs));

    // Una fila individual nunca debe tumbar el resto del lote ni quedar
    // atascada en ENVIANDO: cualquier error inesperado la manda a
    // REINTENTAR (o a ERROR si ya agotó los reintentos) en vez de dejarla
    // sin resolver.
    // Individual: una fila = una prefactura. Consolidado (sin correo
    // registrado, ver encolarEnviosAction): una fila = un ZIP con varias.
    const prefacturaIds = envio.prefactura_id ? [envio.prefactura_id] : (envio.prefactura_ids ?? []);

    try {
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
      } else if (envio.zip_storage_key) {
        const { data: blob } = await supabase.storage.from("prefacturas").download(envio.zip_storage_key);
        if (blob) {
          adjuntos = [
            {
              nombreArchivo: envio.zip_nombre_archivo ?? "prefacturas.zip",
              contenido: Buffer.from(await blob.arrayBuffer()),
              contentType: "application/zip",
            },
          ];
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
        if (prefacturaIds.length > 0) {
          await supabase.from("prefactura").update({ estado: "ENVIADA" }).in("id", prefacturaIds);
        }
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
        if (agotado && prefacturaIds.length > 0) {
          await supabase.from("prefactura").update({ estado: "ERROR_ENVIO" }).in("id", prefacturaIds);
        }
      }

      if (envio.lote_id) {
        await supabase.rpc("incrementar_progreso_lote", {
          p_lote_id: envio.lote_id,
          p_exitoso: resultado.ok,
        });
      }

      const guias = (
        await Promise.all(prefacturaIds.map((id) => obtenerGuiasPrefactura(supabase, id)))
      ).flat();
      await registrarLogEjecucion(
        supabase,
        envio.id,
        "CORREO",
        guias.map((guia) => ({
          guia,
          estado: resultado.ok ? "OK" : "ERROR",
          detalle: resultado.ok ? { prefacturaIds } : { prefacturaIds, error: resultado.error },
        })),
      );
    } catch (error) {
      fallidos++;
      const mensaje = error instanceof Error ? error.message : "Error desconocido procesando el envío.";
      console.error("Error procesando envío de correo", envio.id, error);
      const intentos = envio.intentos + 1;
      const agotado = intentos >= maxReintentos;
      await supabase
        .from("envio_correo")
        .update({
          estado: agotado ? "ERROR" : "REINTENTAR",
          intentos,
          error: mensaje,
          proximo_intento: agotado ? null : new Date(Date.now() + 2 ** intentos * 60_000).toISOString(),
        })
        .eq("id", envio.id);
      if (agotado && prefacturaIds.length > 0) {
        await supabase.from("prefactura").update({ estado: "ERROR_ENVIO" }).in("id", prefacturaIds);
      }
      if (envio.lote_id) {
        await supabase.rpc("incrementar_progreso_lote", { p_lote_id: envio.lote_id, p_exitoso: false });
      }
    }
  }

  return NextResponse.json({ procesados: lote.length, exitosos, fallidos });
}
