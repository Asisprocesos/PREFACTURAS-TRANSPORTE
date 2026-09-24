"use server";

import { revalidatePath } from "next/cache";

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

export interface ResultadoEliminarDocumentos {
  ok: boolean;
  eliminados?: number;
  error?: string;
}

/**
 * Borrado físico (no lógico): pensado para limpiar PDFs de pruebas antes de
 * pasar a producción, no para el uso normal del día a día (ahí lo correcto
 * es regenerar una versión nueva, no borrar el historial). Solo ADMIN puede
 * ejecutarlo porque la política de Storage del bucket "prefacturas" solo
 * permite borrar archivos a ese rol (`prefacturas_admin_borra`); con
 * OPERADOR_TRANSPORTE el borrado del archivo fallaría silenciosamente y
 * dejaría el blob huérfano en Storage.
 */
export async function eliminarDocumentosPdfAction(ids: string[]): Promise<ResultadoEliminarDocumentos> {
  await requireRole(["ADMIN"]);
  if (ids.length === 0) return { ok: false, error: "No hay documentos seleccionados." };

  const supabase = await createClient();

  const { data: documentos, error: errorConsulta } = await supabase
    .from("documento_pdf")
    .select("id, prefactura_id, storage_key, estado")
    .in("id", ids);
  if (errorConsulta) return { ok: false, error: "No se pudieron consultar los documentos seleccionados." };
  if (!documentos || documentos.length === 0) {
    return { ok: false, error: "No se encontraron los documentos seleccionados." };
  }

  // Los envíos de correo (historial) pueden apuntar a estas versiones vía
  // documento_pdf_id: se desvinculan (sin borrar el registro del envío) para
  // no chocar con la referencia antes de borrar el documento.
  const { error: errorDesvincular } = await supabase
    .from("envio_correo")
    .update({ documento_pdf_id: null })
    .in("documento_pdf_id", ids);
  if (errorDesvincular) {
    return { ok: false, error: "No se pudo desvincular el historial de envíos de estos documentos." };
  }

  const { error: errorStorage } = await supabase.storage
    .from("prefacturas")
    .remove(documentos.map((d) => d.storage_key));
  if (errorStorage) {
    return {
      ok: false,
      error: `No se pudieron eliminar los archivos del almacenamiento: ${errorStorage.message}`,
    };
  }

  const { error: errorBorrado } = await supabase.from("documento_pdf").delete().in("id", ids);
  if (errorBorrado) return { ok: false, error: "No se pudieron eliminar los documentos." };

  // Si se borró la versión vigente de alguna prefactura, esa prefactura se
  // queda sin PDF: se recalcula version_actual a partir de lo que quede
  // (para no chocar con la restricción única prefactura_id+version en la
  // próxima generación) y el estado vuelve a "LISTA" para que la UI deje de
  // mostrar "Regenerar"/"Ver PDF" sobre un documento que ya no existe.
  const prefacturaIdsVigentesBorrados = [
    ...new Set(documentos.filter((d) => d.estado === "VIGENTE").map((d) => d.prefactura_id)),
  ];
  for (const prefacturaId of prefacturaIdsVigentesBorrados) {
    const { data: restante } = await supabase
      .from("documento_pdf")
      .select("version")
      .eq("prefactura_id", prefacturaId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    await supabase
      .from("prefactura")
      .update({ estado: "LISTA", version_actual: restante?.version ?? 0 })
      .eq("id", prefacturaId);
  }

  revalidatePath("/repositorio");
  revalidatePath("/repositorio/[prefacturaId]/versiones", "page");
  revalidatePath("/prefacturas");
  revalidatePath("/prefacturas/[id]", "page");

  return { ok: true, eliminados: documentos.length };
}
