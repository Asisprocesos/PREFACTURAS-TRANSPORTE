"use server";

import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { DecisionFila, Json } from "@/types/database.types";

import type { CampoOdt } from "./campos";
import { recalcularResumenImportacion } from "./resumen";
import { construirContextoBase, type ResumenValidacion } from "./validar-action";
import { validarFila, type DatosNormalizadosOdt } from "./validar";

export interface CorreccionFila {
  guia?: string;
  placa?: string;
  /** yyyy-mm-dd, tal como lo entrega un <input type="date">. */
  fechaCreacion?: string;
  valor?: string;
  tipoRuta?: string;
  tipoCosto?: string;
  estado?: string;
}

export interface ResultadoCorreccionFila {
  ok: boolean;
  error?: string;
  errores?: string[];
  advertencias?: string[];
  resumen?: ResumenValidacion;
}

function isoADdMmAaaa(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

function ddMmAaaaDesdeIso(iso: string | null | undefined): string {
  return iso ? isoADdMmAaaa(iso) : "";
}

/**
 * Corrige los datos ya normalizados de una fila del staging (guía, placa,
 * fecha de creación, valor, tipo de ruta, estado) y la vuelve a validar con
 * `validarFila` — las mismas reglas de negocio que la validación inicial,
 * para que "Corregir" no pueda dejar una fila en un estado que la
 * validación normal nunca aceptaría. Si queda sin errores, la decisión pasa
 * a INSERTAR automáticamente; si sigue habiendo errores, la fila permanece
 * sin decidir (no se inserta) y los errores/advertencias se refrescan para
 * que el operador pueda intentar de nuevo.
 */
export async function corregirFilaImportacionAction(
  filaId: string,
  correccion: CorreccionFila,
): Promise<ResultadoCorreccionFila> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: fila, error: errorFila } = await supabase
    .from("importacion_fila")
    .select("id, importacion_id, numero_fila, datos_normalizados")
    .eq("id", filaId)
    .maybeSingle();
  if (errorFila || !fila) return { ok: false, error: "Fila no encontrada." };

  const { data: importacion, error: errorImportacion } = await supabase
    .from("importacion")
    .select("id, periodo_id")
    .eq("id", fila.importacion_id)
    .maybeSingle();
  if (errorImportacion || !importacion?.periodo_id) {
    return { ok: false, error: "La importación no tiene un período asociado." };
  }

  const normActual = fila.datos_normalizados as unknown as DatosNormalizadosOdt | null;
  const guiaFinal = (correccion.guia ?? normActual?.guia ?? "").trim();

  const [contextoBase, { data: otrasFilas }, { data: enBD }] = await Promise.all([
    construirContextoBase(supabase, importacion.periodo_id),
    supabase
      .from("importacion_fila")
      .select("datos_normalizados")
      .eq("importacion_id", fila.importacion_id)
      .neq("id", filaId),
    guiaFinal
      ? supabase.from("odt").select("guia").eq("guia", guiaFinal)
      : Promise.resolve({ data: [] as { guia: string }[] }),
  ]);

  // Duplicado dentro del archivo: comparar contra las demás filas del mismo
  // staging (nunca contra sí misma), igual que la validación inicial.
  const guiasVistasEnArchivo = new Set<string>(
    (otrasFilas ?? [])
      .map((f) => (f.datos_normalizados as { guia?: string } | null)?.guia)
      .filter((g): g is string => Boolean(g))
      .map((g) => g.trim().toUpperCase()),
  );
  const guiasExistentesBD = new Set<string>((enBD ?? []).map((o) => o.guia.trim().toUpperCase()));

  const filaSintetica: Partial<Record<CampoOdt, string>> = {
    guia: guiaFinal,
    chofer: normActual?.chofer ?? "",
    ruta: normActual?.ruta ?? "",
    regional_origen: normActual?.regionalOrigenTexto ?? "",
    estado: (correccion.estado ?? normActual?.estadoFenix ?? "").trim(),
    fecha_recepcion: ddMmAaaaDesdeIso(normActual?.fechaRecepcion),
    valor: correccion.valor ?? (normActual?.valor != null ? String(normActual.valor) : ""),
    tipo_costo: (correccion.tipoCosto ?? normActual?.tipoCosto ?? "").trim(),
    tipo_ruta: (correccion.tipoRuta ?? normActual?.tipoRuta ?? "").trim(),
    ruta_zona: normActual?.rutaZona ?? "",
    placa: (correccion.placa ?? normActual?.placaNormalizada ?? normActual?.placaOriginal ?? "").trim(),
    regional_destino: normActual?.regionalDestinoTexto ?? "",
    fecha_creacion: correccion.fechaCreacion
      ? isoADdMmAaaa(correccion.fechaCreacion)
      : ddMmAaaaDesdeIso(normActual?.fechaCreacion),
    usuario_fenix: normActual?.usuarioFenix ?? "",
    detalle_ruta: normActual?.detalleRuta ?? "",
  };

  const resultado = validarFila(
    fila.numero_fila,
    filaSintetica,
    { ...contextoBase, guiasExistentesBD },
    guiasVistasEnArchivo,
  );

  const decision: DecisionFila | null = resultado.excluida
    ? "OMITIR"
    : resultado.errores.length > 0
      ? null
      : "INSERTAR";

  const { error: errorUpdate } = await supabase
    .from("importacion_fila")
    .update({
      datos_normalizados: resultado.datosNormalizados as unknown as Json,
      errores: resultado.errores as unknown as Json,
      advertencias: resultado.advertencias as unknown as Json,
      decision,
    })
    .eq("id", filaId);
  if (errorUpdate) return { ok: false, error: "No se pudo guardar la corrección." };

  const resumen = await recalcularResumenImportacion(fila.importacion_id);

  return { ok: true, errores: resultado.errores, advertencias: resultado.advertencias, resumen };
}
