import { defaultAppConfig } from "@/config/app.config";

/**
 * true si el correo es del dominio de la empresa o está en la lista de
 * excepciones (config/app.config.ts -> correosPermitidosAdicionales): un
 * correo completo ("nombre@gmail.com") o, si empieza con "@", un dominio
 * adicional completo ("@otraempresa.com").
 */
export function correoPermitido(email: string): boolean {
  const correo = email.toLowerCase().trim();
  if (correo.endsWith(`@${defaultAppConfig.dominioCorreoPermitido.toLowerCase()}`)) return true;
  return defaultAppConfig.correosPermitidosAdicionales.some((patron) => {
    const p = patron.toLowerCase().trim();
    return p.startsWith("@") ? correo.endsWith(p) : correo === p;
  });
}

export const mensajeCorreoNoPermitido = `El correo debe ser @${defaultAppConfig.dominioCorreoPermitido} (o estar en la lista de excepciones autorizadas).`;
