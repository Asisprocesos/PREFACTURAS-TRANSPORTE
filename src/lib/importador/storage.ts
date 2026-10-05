"use server";

import { randomUUID } from "node:crypto";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const EXTENSIONES_PERMITIDAS = [".xlsx", ".xls", ".xlsb", ".csv"];
const TAMANO_MAXIMO_BYTES = 50 * 1024 * 1024; // 50 MB, cubre el .xlsb de referencia (~39 MB)

export interface SolicitudSubida {
  storageKey: string;
  urlFirmada: string;
  token: string;
}

/**
 * Crea una URL firmada de subida directa a Storage (bucket `imports`). El
 * archivo NUNCA pasa por el body de una Server Action / Route Handler.
 */
export async function crearUrlSubidaImportacion(
  nombreArchivo: string,
  tamanoBytes: number,
): Promise<SolicitudSubida> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const extension = nombreArchivo.slice(nombreArchivo.lastIndexOf(".")).toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
    throw new Error(`Extensión no permitida. Usa: ${EXTENSIONES_PERMITIDAS.join(", ")}.`);
  }
  if (tamanoBytes > TAMANO_MAXIMO_BYTES) {
    throw new Error(`El archivo supera el máximo permitido (${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB).`);
  }

  const storageKey = `${perfil.userId}/${Date.now()}-${randomUUID()}${extension}`;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("imports").createSignedUploadUrl(storageKey);
  if (error || !data) {
    throw new Error("No se pudo crear la URL de subida.");
  }

  return { storageKey, urlFirmada: data.signedUrl, token: data.token };
}

/**
 * URL firmada de descarga para recuperar el archivo original de una
 * importación ya subida (ver guardarBorradorImportacionAction): permite
 * reanudar el mapeo desde /importar/{id} sin pedirle al usuario que vuelva a
 * elegir el archivo de su computador.
 */
export async function crearUrlDescargaImportacionAction(
  importacionId: string,
): Promise<{ url: string; nombreArchivo: string }> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: importacion, error: errorImportacion } = await supabase
    .from("importacion")
    .select("storage_key, archivo")
    .eq("id", importacionId)
    .single();
  if (errorImportacion || !importacion) throw new Error("Importación no encontrada.");

  const { data, error } = await supabase.storage
    .from("imports")
    .createSignedUrl(importacion.storage_key, 300);
  if (error || !data) throw new Error("No se pudo generar el enlace de descarga del archivo original.");

  return { url: data.signedUrl, nombreArchivo: importacion.archivo };
}
