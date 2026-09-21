import "server-only";

import nodemailer from "nodemailer";

import type { EmailMensaje, EmailProvider, EmailResultado } from "../tipos";

/**
 * Adaptador SMTP (Zimbra). Debe ejecutarse en un Route Handler con
 * `export const runtime = "nodejs"`: las Supabase Edge Functions bloquean
 * salientes a los puertos 25/587/465.
 */
export function crearProveedorSmtp(): EmailProvider {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM ?? user;
  const replyTo = process.env.EMAIL_REPLY_TO;

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
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Error desconocido enviando el correo.",
          permanente,
        };
      }
    },
  };
}
