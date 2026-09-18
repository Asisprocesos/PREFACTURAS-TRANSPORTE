"use server";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export interface ImportacionExistente {
  id: string;
  archivo: string;
  estado: string;
  creadaEn: string;
}

export interface RegistrarImportacionResultado {
  id: string;
  yaExistia: boolean;
  importacionPrevia?: ImportacionExistente;
}

/**
 * Registra el archivo ya subido a Storage. Si el hash ya existe, no crea
 * una fila nueva: devuelve la importación previa para que el usuario
 * decida (ver el historial o continuar de todas formas).
 */
export async function registrarImportacion(datos: {
  archivo: string;
  storageKey: string;
  hashSha256: string;
}): Promise<RegistrarImportacionResultado> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: previa } = await supabase
    .from("importacion")
    .select("id, archivo, estado, created_at")
    .eq("hash_sha256", datos.hashSha256)
    .maybeSingle();

  if (previa) {
    return {
      id: previa.id,
      yaExistia: true,
      importacionPrevia: {
        id: previa.id,
        archivo: previa.archivo,
        estado: previa.estado,
        creadaEn: previa.created_at,
      },
    };
  }

  const { data, error } = await supabase
    .from("importacion")
    .insert({
      archivo: datos.archivo,
      storage_key: datos.storageKey,
      hash_sha256: datos.hashSha256,
      usuario: perfil.userId,
      estado: "BORRADOR",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("No se pudo registrar la importación.");
  }

  return { id: data.id, yaExistia: false };
}
