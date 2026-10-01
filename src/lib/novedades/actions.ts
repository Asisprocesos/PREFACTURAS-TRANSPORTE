"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/roles";
import { extraerPlacaNoRegistrada, extraerTipoRutaPorRevisar } from "@/lib/importador/mensajes";
import { categorizarNovedad } from "@/lib/novedades/categorias";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/lib/types/acciones";

export interface ResultadoResolucionNovedad extends ResultadoAccion {
  /** Otras novedades idénticas (misma causa, distinta ODT) resueltas junto con esta. */
  otrasResueltas?: number;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Categorías cuyo texto, según el propio comentario de
 * src/lib/importador/mensajes.ts, "apunta a datos que viven en OTRO módulo"
 * (un catálogo compartido), no en la fila de la ODT: todas las novedades con
 * el mismo mensaje exacto en el período comparten la misma causa raíz, así
 * que al confirmar que esa causa ya no existe, resolver una las resuelve
 * todas. El resto de categorías (placa recuperada del chofer, tipo de ruta/
 * costo/fecha/valor vacíos o inválidos, etc.) dependen del dato propio de
 * cada ODT — resolver una ahí NO debe tocar las demás, aunque el texto sea
 * idéntico.
 */
const REGLAS_CATEGORIA_COMPARTIDA: Record<
  string,
  {
    extraerClave: (mensaje: string) => string | null;
    causaResuelta: (supabase: SupabaseServerClient, clave: string) => Promise<boolean>;
  }
> = {
  placa_no_registrada: {
    extraerClave: extraerPlacaNoRegistrada,
    causaResuelta: async (supabase, placa) => {
      const { data } = await supabase
        .from("vehiculo")
        .select("placa")
        .eq("placa", placa)
        .is("deleted_at", null)
        .maybeSingle();
      return !!data;
    },
  },
  tipo_ruta_por_revisar: {
    extraerClave: extraerTipoRutaPorRevisar,
    causaResuelta: async (supabase, tipoRuta) => {
      const { data } = await supabase
        .from("tipo_ruta_centro_costo")
        .select("requiere_revision, centro_costo")
        .eq("tipo_ruta", tipoRuta)
        .eq("activo", true)
        .is("deleted_at", null)
        .maybeSingle();
      return !!data && !data.requiere_revision && !!data.centro_costo;
    },
  },
};

export async function resolverNovedadAction(
  novedadId: string,
  resolucion: string,
  marcarComo: "RESUELTA" | "IGNORADA" = "RESUELTA",
): Promise<ResultadoResolucionNovedad> {
  const perfil = await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  const supabase = await createClient();

  const { data: novedad } = await supabase
    .from("novedad")
    .select("mensaje, periodo_id")
    .eq("id", novedadId)
    .single();

  const { error } = await supabase
    .from("novedad")
    .update({ estado: marcarComo, resolucion, resuelta_por: perfil.userId })
    .eq("id", novedadId);

  if (error) return { ok: false, error: "No se pudo actualizar la novedad." };

  // Solo al "Resolver" (no al "Ignorar": ignorar una no implica que la causa
  // de las demás ya no aplica) y solo si el mensaje es de una categoría
  // compartida, se verifica contra la base de datos que la causa raíz
  // realmente ya no existe antes de arrastrar la resolución a las demás.
  let otrasResueltas = 0;
  if (marcarComo === "RESUELTA" && novedad?.periodo_id) {
    const categoria = categorizarNovedad(novedad.mensaje);
    const regla = REGLAS_CATEGORIA_COMPARTIDA[categoria];
    const clave = regla?.extraerClave(novedad.mensaje) ?? null;
    if (regla && clave && (await regla.causaResuelta(supabase, clave))) {
      const { data: resueltas } = await supabase
        .from("novedad")
        .update({
          estado: "RESUELTA",
          resolucion: `${resolucion} (resuelta junto con otra ODT: la misma causa ya no aplica)`,
          resuelta_por: perfil.userId,
        })
        .eq("periodo_id", novedad.periodo_id)
        .eq("mensaje", novedad.mensaje)
        .eq("estado", "ABIERTA")
        .select("id");
      otrasResueltas = resueltas?.length ?? 0;
    }
  }

  // "/control-placa" solo revalida esa página exacta; sin también apuntar al
  // patrón dinámico, el detalle por placa (de donde sale esta acción) y la
  // tarjeta de novedades de la prefactura podían seguir mostrando la
  // novedad como abierta desde el Router Cache del cliente.
  revalidatePath("/control-placa");
  revalidatePath("/control-placa/[placa]", "page");
  revalidatePath("/prefacturas/[id]", "page");
  return { ok: true, otrasResueltas };
}
