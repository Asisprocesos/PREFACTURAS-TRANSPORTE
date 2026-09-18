"use server";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export interface ResultadoUrl {
  ok: boolean;
  url?: string;
  nombreArchivo?: string;
  error?: string;
}

/**
 * URL firmada de 5 minutos para ver o descargar un documento. Registra la
 * acción en `auditoria` (requisito explícito: "descargar... registra la
 * descarga en auditoría").
 */
export async function obtenerUrlDocumentoAction(
  documentoId: string,
  accion: "VISUALIZACION" | "DESCARGA",
): Promise<ResultadoUrl> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const supabase = await createClient();

  const { data: documento, error } = await supabase
    .from("documento_pdf")
    .select("storage_key, nombre_archivo")
    .eq("id", documentoId)
    .maybeSingle();
  if (error || !documento) return { ok: false, error: "Documento no encontrado." };

  const { data: firmada, error: errorFirma } = await supabase.storage
    .from("prefacturas")
    .createSignedUrl(documento.storage_key, 300, {
      download: accion === "DESCARGA" ? documento.nombre_archivo : undefined,
    });
  if (errorFirma || !firmada) return { ok: false, error: "No se pudo generar el enlace." };

  await supabase.from("auditoria").insert({
    usuario: perfil.userId,
    accion,
    tabla: "documento_pdf",
    registro_id: documentoId,
  });

  return { ok: true, url: firmada.signedUrl, nombreArchivo: documento.nombre_archivo };
}
