import { CAMPOS_ODT, type CampoOdt } from "./campos";

export interface AliasMapeo {
  alias_origen: string;
  campo_interno: string; // "odt.guia"
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Sugiere, para cada encabezado detectado en el archivo, el campo interno
 * de `odt` que le corresponde, usando primero los alias guardados en
 * `mapeo_columna` (tabla configurable) y, si no hay match, una comparación
 * normalizada (minúsculas, sin tildes) contra el nombre del campo.
 */
export function sugerirMapeo(
  encabezados: string[],
  aliasGuardados: AliasMapeo[],
): Record<string, CampoOdt | null> {
  const aliasPorEncabezado = new Map<string, CampoOdt>();
  for (const a of aliasGuardados) {
    if (!a.campo_interno.startsWith("odt.")) continue;
    const campo = a.campo_interno.slice(4) as CampoOdt;
    if ((CAMPOS_ODT as readonly string[]).includes(campo)) {
      aliasPorEncabezado.set(normalizar(a.alias_origen), campo);
    }
  }

  const resultado: Record<string, CampoOdt | null> = {};
  for (const encabezado of encabezados) {
    const norm = normalizar(encabezado);
    resultado[encabezado] =
      aliasPorEncabezado.get(norm) ??
      ((CAMPOS_ODT as readonly string[]).find((c) => normalizar(c) === norm) as CampoOdt | undefined) ??
      null;
  }
  return resultado;
}

/**
 * Aplica un mapeo confirmado (encabezado -> campo interno) a una fila cruda
 * (keyed por encabezado) y devuelve un objeto keyed por campo interno.
 */
export function aplicarMapeo(
  filaCruda: Record<string, unknown>,
  mapeo: Record<string, CampoOdt | null>,
): Partial<Record<CampoOdt, string>> {
  const resultado: Partial<Record<CampoOdt, string>> = {};
  for (const [encabezado, campo] of Object.entries(mapeo)) {
    if (!campo) continue;
    const valor = filaCruda[encabezado];
    resultado[campo] = valor === undefined || valor === null ? "" : String(valor).trim();
  }
  return resultado;
}
