import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { obtenerAjustesCorreoPrueba, separarCorreos } from "@/lib/config/correo-prueba";
import { obtenerAjustesCuentaCorreo, type CuentaCorreo } from "@/lib/config/cuenta-correo";
import type { Database } from "@/types/database.types";

import { crearProveedorResend } from "./providers/resend";
import { crearProveedorSmtp } from "./providers/smtp";
import type { EmailMensaje, EmailProvider, EmailResultado } from "./tipos";

/**
 * Fábrica de EmailProvider según EMAIL_PROVIDER. `smtp` (Zimbra o Gmail) y
 * `resend` están implementados; brevo/ses quedan como adaptadores futuros
 * intercambiables — fallan con un mensaje claro en vez de simular un envío
 * que no ocurre. `cuenta` solo aplica a smtp (ver cuenta-correo.ts): resend
 * no tiene el concepto de cuenta principal/respaldo.
 */
function crearProveedor(cuenta: CuentaCorreo): EmailProvider {
  const proveedor = process.env.EMAIL_PROVIDER ?? "smtp";
  switch (proveedor) {
    case "smtp":
      return crearProveedorSmtp(cuenta);
    case "resend":
      return crearProveedorResend();
    default:
      throw new Error(
        `EMAIL_PROVIDER="${proveedor}" no está implementado todavía. Adaptadores disponibles: smtp, resend.`,
      );
  }
}

/**
 * Envuelve el proveedor real con el modo prueba: si está activo, redirige
 * TODOS los correos al/los destinatario(s) de prueba y antepone el
 * destinatario real al asunto, para poder validar el flujo completo sin
 * arriesgar un envío real a un transportista. Admite varios correos
 * separados por coma (ej. "persona1@dominio.com, persona2@dominio.com")
 * para que más de una persona reciba las pruebas.
 *
 * Los ajustes salen de obtenerAjustesCorreoPrueba(): editables desde
 * Configuración (solo ADMIN) sin redesplegar, o de las variables de
 * entorno EMAIL_TEST_MODE/EMAIL_TEST_RECIPIENT si nunca se guardaron ahí.
 *
 * `supabaseClient`: pásalo (el cliente admin) cuando se llama sin sesión de
 * usuario, como desde `/api/jobs/email` — ver el comentario en
 * correo-prueba.ts, es la diferencia entre que el worker vea lo guardado en
 * Configuración o que siempre caiga en silencio a las variables de entorno.
 */
export async function obtenerEmailProvider(
  supabaseClient?: SupabaseClient<Database>,
): Promise<EmailProvider> {
  const { cuentaActiva } = await obtenerAjustesCuentaCorreo(supabaseClient);
  const real = crearProveedor(cuentaActiva);
  const ajustes = await obtenerAjustesCorreoPrueba(supabaseClient);
  if (!ajustes.modoPrueba) return real;

  const destinatariosPrueba = separarCorreos(ajustes.destinatarioPrueba);
  if (destinatariosPrueba.length === 0) {
    throw new Error(
      "El modo prueba de correo está activo pero no hay destinatario de prueba configurado (Configuración o EMAIL_TEST_RECIPIENT).",
    );
  }

  return {
    async enviar(mensaje: EmailMensaje): Promise<EmailResultado> {
      const destinatariosOriginales = [...mensaje.to, ...(mensaje.cc ?? [])].join(", ");
      return real.enviar({
        ...mensaje,
        to: destinatariosPrueba,
        cc: undefined,
        asunto: `[PRUEBA → ${destinatariosOriginales}] ${mensaje.asunto}`,
      });
    },
  };
}
