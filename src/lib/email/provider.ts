import "server-only";

import { crearProveedorResend } from "./providers/resend";
import { crearProveedorSmtp } from "./providers/smtp";
import type { EmailMensaje, EmailProvider, EmailResultado } from "./tipos";

/**
 * Fábrica de EmailProvider según EMAIL_PROVIDER. `smtp` (Zimbra) y `resend`
 * están implementados; brevo/ses quedan como adaptadores futuros
 * intercambiables — fallan con un mensaje claro en vez de simular un envío
 * que no ocurre.
 */
function crearProveedor(): EmailProvider {
  const proveedor = process.env.EMAIL_PROVIDER ?? "smtp";
  switch (proveedor) {
    case "smtp":
      return crearProveedorSmtp();
    case "resend":
      return crearProveedorResend();
    default:
      throw new Error(
        `EMAIL_PROVIDER="${proveedor}" no está implementado todavía. Adaptadores disponibles: smtp, resend.`,
      );
  }
}

/**
 * Envuelve el proveedor real con el modo prueba: si EMAIL_TEST_MODE=true,
 * redirige TODOS los correos a EMAIL_TEST_RECIPIENT y antepone el
 * destinatario real al asunto, para poder validar el flujo completo sin
 * arriesgar un envío real a un transportista.
 */
export function obtenerEmailProvider(): EmailProvider {
  const real = crearProveedor();
  const modoPrueba = process.env.EMAIL_TEST_MODE !== "false"; // por defecto true, ver config/app.config.ts
  if (!modoPrueba) return real;

  const destinatarioPrueba = process.env.EMAIL_TEST_RECIPIENT;
  if (!destinatarioPrueba) {
    throw new Error("EMAIL_TEST_MODE está activo pero falta EMAIL_TEST_RECIPIENT.");
  }

  return {
    async enviar(mensaje: EmailMensaje): Promise<EmailResultado> {
      const destinatariosOriginales = [...mensaje.to, ...(mensaje.cc ?? [])].join(", ");
      return real.enviar({
        ...mensaje,
        to: [destinatarioPrueba],
        cc: undefined,
        asunto: `[PRUEBA → ${destinatariosOriginales}] ${mensaje.asunto}`,
      });
    },
  };
}
