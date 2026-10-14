import "server-only";

import nodemailer from "nodemailer";

import type { CuentaCorreo } from "@/lib/config/cuenta-correo";

import type { EmailMensaje, EmailProvider, EmailResultado } from "../tipos";

const ETIQUETA_CUENTA: Record<CuentaCorreo, string> = {
  PRINCIPAL: "principal",
  RESPALDO: "de respaldo",
};

/**
 * Patrones del rechazo de Gmail cuando se agota el límite diario de envíos
 * (500/día en cuentas personales, 2000/día en Workspace) — "550-5.4.5 Daily
 * user sending limit exceeded..." es el más común, pero Gmail también usa
 * variantes 4.x.x según el momento. A diferencia de un buzón inexistente,
 * esto no es un problema de ESTE correo ni definitivo: se resuelve solo al
 * día siguiente, o antes si se cambia a la cuenta de respaldo.
 */
const PATRON_CUPO_AGOTADO = /5\.4\.5|4\.5\.3|sending (quota|limit)/i;

/**
 * Adaptador SMTP genérico (nodemailer) — funciona igual con Zimbra o con
 * Gmail/Workspace. `cuenta` decide qué set de variables de entorno usar:
 * SMTP_* para la cuenta PRINCIPAL, SMTP_*_RESPALDO para la de RESPALDO (ver
 * cuenta-correo.ts, editable desde Configuración sin redesplegar). Debe
 * ejecutarse en un Route Handler con `export const runtime = "nodejs"`: las
 * Supabase Edge Functions bloquean salientes a los puertos 25/587/465.
 */
export function crearProveedorSmtp(cuenta: CuentaCorreo = "PRINCIPAL"): EmailProvider {
  const sufijo = cuenta === "RESPALDO" ? "_RESPALDO" : "";
  const host = process.env[`SMTP_HOST${sufijo}`]?.trim();
  const port = Number(process.env[`SMTP_PORT${sufijo}`] ?? "587");
  // Tolerante a mayúsculas/minúsculas y espacios: un valor mal transcrito
  // (ej. "True" en vez de "true") no debe hacer que se intente una
  // conexión sin TLS contra un puerto que lo exige desde el primer byte
  // (465) — eso se queda colgado hasta el connectionTimeout sin dar ninguna
  // pista de la causa real.
  const secure = /^(true|1|yes|si|sí)$/i.test((process.env[`SMTP_SECURE${sufijo}`] ?? "").trim());
  const user = process.env[`SMTP_USER${sufijo}`]?.trim();
  const pass = process.env[`SMTP_PASSWORD${sufijo}`]?.trim();
  const from = process.env[`EMAIL_FROM${sufijo}`]?.trim() ?? process.env.EMAIL_FROM?.trim() ?? user;
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  if (!host || !user || !pass) {
    throw new Error(
      cuenta === "RESPALDO"
        ? "La cuenta de respaldo está activa en Configuración, pero faltan SMTP_HOST_RESPALDO/SMTP_USER_RESPALDO/SMTP_PASSWORD_RESPALDO en las variables de entorno."
        : "Faltan SMTP_HOST/SMTP_USER/SMTP_PASSWORD en las variables de entorno.",
    );
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
        const respuestaServidor = String((err as { response?: string }).response ?? "");
        const codigoRed = (err as { code?: string }).code;
        let mensaje = err instanceof Error ? err.message : "Error desconocido enviando el correo.";

        const cupoAgotado = PATRON_CUPO_AGOTADO.test(`${mensaje} ${respuestaServidor}`);
        if (cupoAgotado) {
          mensaje = `Se alcanzó el límite diario de envíos de la cuenta ${ETIQUETA_CUENTA[cuenta]} de Gmail. ${mensaje}`;
        } else if (codigoRed === "ETIMEDOUT" || codigoRed === "ESOCKET" || codigoRed === "ECONNREFUSED") {
          // No es un problema de credenciales: la conexión TCP/TLS con
          // SMTP_HOST:SMTP_PORT nunca se completó. La causa típica es que el
          // servidor de correo solo acepta conexiones desde IPs conocidas
          // (red de la oficina) y no desde el servidor de Vercel.
          mensaje = `${mensaje} — no se pudo conectar a ${host}:${port} desde el servidor. Verifica que el firewall del correo permita conexiones desde internet, o considera un proveedor de correo transaccional (SMTP relay / API) en vez de conectarse directo al servidor interno.`;
        }

        // El cupo agotado nunca es "permanente" en el sentido de email
        // inválido — es temporal a nivel de cuenta, no de este correo.
        const permanente = !cupoAgotado && typeof codigo === "number" && codigo >= 500;
        return { ok: false, error: mensaje, permanente, cupoAgotado };
      }
    },
  };
}
