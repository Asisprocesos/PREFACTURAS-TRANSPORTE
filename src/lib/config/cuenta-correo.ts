import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CuentaCorreo = "PRINCIPAL" | "RESPALDO";

export interface AjustesCuentaCorreo {
  cuentaActiva: CuentaCorreo;
  limiteDiario: number;
}

const CLAVE = "cuenta_correo";
const LIMITE_POR_DEFECTO = 500;

/**
 * Con cuál de las dos cuentas SMTP configuradas se envía (ver
 * smtp.ts: SMTP_* para PRINCIPAL, SMTP_*_RESPALDO para RESPALDO) y el límite
 * diario de envíos a mostrar en el contador visual — editable desde
 * Configuración (solo ADMIN) sin redesplegar. Pensado para el límite de
 * Gmail (500/día en cuentas personales, 2000/día en Workspace): cuando la
 * cuenta activa se acerca o llega al límite, Configuración y la pantalla de
 * envío masivo lo muestran, y el ADMIN cambia la cuenta activa a RESPALDO
 * desde acá para seguir enviando.
 */
export async function obtenerAjustesCuentaCorreo(): Promise<AjustesCuentaCorreo> {
  const supabase = await createClient();
  const { data } = await supabase.from("configuracion").select("valor").eq("clave", CLAVE).maybeSingle();
  const guardado = (data?.valor ?? {}) as Partial<AjustesCuentaCorreo>;
  return {
    cuentaActiva: guardado.cuentaActiva === "RESPALDO" ? "RESPALDO" : "PRINCIPAL",
    limiteDiario: Number(guardado.limiteDiario ?? process.env.EMAIL_LIMITE_DIARIO ?? LIMITE_POR_DEFECTO),
  };
}

/**
 * Correos ya enviados hoy (día calendario de Ecuador, UTC-5 todo el año —
 * no hay horario de verano) con la cuenta dada, para el contador visual
 * frente al límite diario. Envíos de antes de que existiera esta columna
 * (proveedor_cuenta null) no se cuentan — son de días ya pasados, no afectan
 * el contador de hoy.
 */
export async function contarEnviadosHoy(cuenta: CuentaCorreo): Promise<number> {
  const supabase = await createClient();
  const fechaGuayaquil = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(
    new Date(),
  );
  const inicioDelDiaUtc = `${fechaGuayaquil}T05:00:00.000Z`;

  const { count, error } = await supabase
    .from("envio_correo")
    .select("*", { count: "exact", head: true })
    .eq("estado", "ENVIADO")
    .eq("proveedor_cuenta", cuenta)
    .gte("enviado_en", inicioDelDiaUtc);
  if (error) throw error;
  return count ?? 0;
}

export interface EstadoEnvioDiario extends AjustesCuentaCorreo {
  enviadosHoy: number;
}

/** Para el contador visual en Configuración y en la pantalla de envío masivo. */
export async function obtenerEstadoEnvioDiario(): Promise<EstadoEnvioDiario> {
  const ajustes = await obtenerAjustesCuentaCorreo();
  const enviadosHoy = await contarEnviadosHoy(ajustes.cuentaActiva);
  return { ...ajustes, enviadosHoy };
}
