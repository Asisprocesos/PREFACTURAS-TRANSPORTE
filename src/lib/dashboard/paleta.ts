/**
 * Paleta validada para gráficos (ver skill dataviz, references/palette.md).
 * Valores fijos: el orden categórico no se altera y los colores de estado
 * nunca se reutilizan como "serie N". Solo modo claro: la app todavía no
 * implementa un selector de tema oscuro.
 */

export const PALETA_CATEGORICA = {
  azul: "#2a78d6",
  naranja: "#eb6834",
  aqua: "#1baf7a",
} as const;

export const PALETA_ESTADO = {
  bueno: "#0ca30c",
  advertencia: "#fab219",
  critico: "#d03b3b",
} as const;

export const COLOR_EJE = "#c3c2b7";
export const COLOR_GRID = "#e1e0d9";
export const COLOR_TEXTO_SECUNDARIO = "#52514e";
