import "server-only";

import { Resend } from "resend";

import type { EmailMensaje, EmailProvider, EmailResultado } from "../tipos";

/**
 * Adaptador Resend (API HTTP): alternativa a SMTP cuando IT no puede abrir
 * el firewall de Zimbra a salientes de Vercel. No maneja puertos/TLS como
 * SMTP — es un simple POST HTTPS.
 */
export function crearProveedorResend(): EmailProvider {
  const apiKey = (process.env.RESEND_API_KEY ?? process.env.EMAIL_API_KEY)?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  if (!apiKey) {
    throw new Error("Falta RESEND_API_KEY (o EMAIL_API_KEY) en las variables de entorno.");
  }
  if (!from) {
    throw new Error("Falta EMAIL_FROM en las variables de entorno.");
  }

  const resend = new Resend(apiKey);

  return {
    async enviar(mensaje: EmailMensaje): Promise<EmailResultado> {
      const { data, error } = await resend.emails.send({
        from,
        replyTo,
        to: mensaje.to,
        cc: mensaje.cc,
        subject: mensaje.asunto,
        text: mensaje.cuerpo,
        attachments: mensaje.adjuntos?.map((a) => ({
          filename: a.nombreArchivo,
          content: a.contenido,
        })),
      });

      if (error) {
        const codigo = error.statusCode;
        // En HTTP (a diferencia de SMTP) un 4xx es lo permanente: la
        // petición está mal formada y reintentarla igual no la arregla
        // (dominio de origen sin verificar, adjunto inválido, etc.). La
        // excepción es 429 (límite de envíos por minuto): eso sí conviene
        // reintentarlo más tarde.
        const permanente =
          codigo !== null && codigo >= 400 && codigo < 500 && error.name !== "rate_limit_exceeded";
        return { ok: false, error: `Resend: ${error.message}`, permanente };
      }
      if (!data) {
        return { ok: false, error: "Resend no devolvió un id de mensaje.", permanente: false };
      }
      return { ok: true, messageId: data.id };
    },
  };
}
