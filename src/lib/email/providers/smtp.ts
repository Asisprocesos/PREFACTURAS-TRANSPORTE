import "server-only";

import nodemailer from "nodemailer";

import type { EmailMensaje, EmailProvider, EmailResultado } from "../tipos";

/**
 * Adaptador SMTP (Zimbra). Debe ejecutarse en un Route Handler con
 * `export const runtime = "nodejs"`: las Supabase Edge Functions bloquean
 * salientes a los puertos 25/587/465.
 */
export function crearProveedorSmtp(): EmailProvider {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  // Tolerante a mayúsculas/minúsculas y espacios: un valor mal transcrito
  // (ej. "True" en vez de "true") no debe hacer que se intente una
  // conexión sin TLS contra un puerto que lo exige desde el primer byte
  // (465) — eso se queda colgado hasta el connectionTimeout sin dar ninguna
  // pista de la causa real.
  const secure = /^(true|1|yes|si|sí)$/i.test((process.env.SMTP_SECURE ?? "").trim());
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.EMAIL_FROM?.trim() ?? user;
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  if (!host || !user || !pass) {
    throw new Error("Faltan SMTP_HOST/SMTP_USER/SMTP_PASSWORD en las variables de entorno.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Sin timeouts, un host SMTP mal configurado o inalcanzable cuelga la
    // conexión indefinidamente y el Server Action nunca resuelve.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return {
    async enviar(mensaje: EmailMensaje): Promise<EmailResultado> {
      try {
        const info = await transporter.sendMail({
          from,
          replyTo,
          to: mensaje.to,
          cc: mensaje.cc,
          subject: mensaje.asunto,
          text: mensaje.cuerpo,
          attachments: mensaje.adjuntos?.map((a) => ({
            filename: a.nombreArchivo,
            content: a.contenido,
            contentType: a.contentType,
          })),
        });
        return { ok: true, messageId: info.messageId };
      } catch (err) {
        const codigo = (err as { responseCode?: number }).responseCode;
        const permanente = typeof codigo === "number" && codigo >= 500;
        const codigoRed = (err as { code?: string }).code;
        let mensaje = err instanceof Error ? err.message : "Error desconocido enviando el correo.";
        if (codigoRed === "ETIMEDOUT" || codigoRed === "ESOCKET" || codigoRed === "ECONNREFUSED") {
          // No es un problema de credenciales: la conexión TCP/TLS con
          // SMTP_HOST:SMTP_PORT nunca se completó. La causa típica es que el
          // servidor de correo solo acepta conexiones desde IPs conocidas
          // (red de la oficina) y no desde el servidor de Vercel.
          mensaje = `${mensaje} — no se pudo conectar a ${host}:${port} desde el servidor. Verifica que el firewall del correo permita conexiones desde internet, o considera un proveedor de correo transaccional (SMTP relay / API) en vez de conectarse directo al servidor interno.`;
        }
        return { ok: false, error: mensaje, permanente };
      }
    },
  };
}
