"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

import { defaultAppConfig } from "@/config/app.config";
import { requireRole } from "@/lib/auth/roles";
import { filasPrefacturas } from "@/lib/reportes/generar";
import { obtenerPrefacturasReporte } from "@/lib/reportes/queries";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

import { contarNovedadesErrorAbiertas, listarPeriodosAdmin, obtenerOdtPeriodoParaArchivo } from "./queries";

/** Cierra un período ABIERTO. Bloqueado si tiene novedades de severidad ERROR sin resolver. */
export async function cerrarPeriodoAction(periodoId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN"]);

  const novedadesError = await contarNovedadesErrorAbiertas(periodoId);
  if (novedadesError > 0) {
    return {
      ok: false,
      error: `Hay ${novedadesError} novedad(es) de severidad error sin resolver en este período.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("periodo")
    .update({ estado: "CERRADO" })
    .eq("id", periodoId)
    .eq("estado", "ABIERTO");
  if (error) return { ok: false, error: "No se pudo cerrar el período." };

  revalidatePath("/configuracion");
  return { ok: true };
}

/**
 * Archiva un período CERRADO: exporta ODT + prefacturas a un snapshot .xlsx
 * en el bucket `archivo`, registra `archivo_periodo` y construye el índice
 * liviano `odt_indice_historico`. No borra `odt`/`prefactura`: el snapshot
 * es un respaldo adicional, no un reemplazo, para que archivar siga siendo
 * una operación reversible con `restaurarPeriodoAction`.
 */
export async function archivarPeriodoAction(periodoId: string): Promise<ResultadoAccion> {
  const perfil = await requireRole(["ADMIN"]);
  const supabase = await createClient();

  const { data: periodo } = await supabase.from("periodo").select("*").eq("id", periodoId).maybeSingle();
  if (!periodo) return { ok: false, error: "Período no encontrado." };
  if (periodo.estado !== "CERRADO") return { ok: false, error: "Solo se pueden archivar períodos cerrados." };

  const [odt, prefacturas] = await Promise.all([
    obtenerOdtPeriodoParaArchivo(periodoId),
    obtenerPrefacturasReporte(periodoId),
  ]);

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filasPrefacturas(prefacturas)), "Prefacturas");
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(
      odt.map((o) => ({
        Guía: o.guia,
        Placa: o.placa_normalizada ?? "",
        "Centro de costo": o.centro_costo_final ?? "",
        Valor: o.valor_final ?? o.valor,
        Fecha: o.fecha_creacion,
      })),
    ),
    "ODT",
  );
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const storageKey = `periodos/${periodo.numero}-${periodoId}.xlsx`;

  const { error: errorSubida } = await supabase.storage.from("archivo").upload(storageKey, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (errorSubida) return { ok: false, error: `No se pudo guardar el respaldo: ${errorSubida.message}` };

  const { error: errorArchivo } = await supabase.from("archivo_periodo").insert({
    periodo_id: periodoId,
    storage_key: storageKey,
    filas: odt.length,
    checksum,
    archivado_por: perfil.userId,
  });
  if (errorArchivo) return { ok: false, error: "No se pudo registrar el respaldo del período." };

  if (odt.length > 0) {
    await supabase.from("odt_indice_historico").insert(
      odt.map((o) => ({
        guia: o.guia,
        placa: o.placa_normalizada,
        periodo_id: periodoId,
        valor: o.valor_final ?? o.valor,
      })),
    );
  }

  await supabase.from("periodo").update({ estado: "ARCHIVADO" }).eq("id", periodoId);

  revalidatePath("/configuracion");
  return { ok: true };
}

/** Vuelve un período ARCHIVADO a CERRADO (modo consulta: los datos nunca se borraron). */
export async function restaurarPeriodoAction(periodoId: string): Promise<ResultadoAccion> {
  await requireRole(["ADMIN"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("periodo")
    .update({ estado: "CERRADO" })
    .eq("id", periodoId)
    .eq("estado", "ARCHIVADO");
  if (error) return { ok: false, error: "No se pudo restaurar el período." };

  revalidatePath("/configuracion");
  return { ok: true };
}

export interface ResultadoArchivadoMasivo extends ResultadoAccion {
  archivados?: number;
}

/**
 * Archiva todos los períodos CERRADOS más allá de los `periodosCalientes`
 * más recientes. Disparo manual desde Configuración a propósito: no hay
 * pg_cron programado para esto porque archivar sube un snapshot y toca
 * varias tablas, y conviene que quede a criterio de un ADMIN en vez de un
 * job silencioso a medianoche.
 */
export async function archivarPeriodosAntiguosAction(): Promise<ResultadoArchivadoMasivo> {
  await requireRole(["ADMIN"]);
  const periodos = await listarPeriodosAdmin();
  const cerrados = periodos
    .filter((p) => p.estado === "CERRADO")
    .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
  const candidatos = cerrados.slice(defaultAppConfig.periodo.periodosCalientes);

  let archivados = 0;
  for (const p of candidatos) {
    const resultado = await archivarPeriodoAction(p.id);
    if (resultado.ok) archivados++;
  }
  return { ok: true, archivados };
}
