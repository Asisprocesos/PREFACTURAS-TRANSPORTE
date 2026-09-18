# public/brand/ — Activos de marca pendientes

Coloca aquí los archivos oficiales de marca de LAARCOURIER. **No redibujes el
logotipo**: usa únicamente los archivos entregados por Grupo LAAR.

| Archivo esperado       | Uso                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `logo-positivo.svg`    | Logo negro sobre amarillo / fondo claro. Encabezado del PDF, pantallas con fondo claro. |
| `logo-negativo.svg`    | Logo blanco con barrido amarillo sobre negro. Barra lateral (fondo `#1D1D1B`).          |
| `logo-gris.svg`        | Logo negro sobre gris claro (`#E1E1E1`). Fondos de tarjeta.                             |
| `icono-lce.svg`        | Ícono "LCE". Favicon y PWA.                                                             |
| `favicon.ico`          | Generado desde `icono-lce.svg` (múltiples tamaños: 16, 32, 48).                         |
| `apple-touch-icon.png` | 180×180, generado desde `icono-lce.svg` sobre fondo negro.                              |

## Tipografía

- `Metropolis` (licencia OFL) debe autoalojarse en `public/fonts/metropolis/`
  en los pesos Light, Regular, Medium, Bold, Black (formatos `.woff2`).
  Extraer del paquete de marca del brandbook 2023.
- Mientras no esté disponible, la interfaz usa `Poppins` vía
  `next/font/google` como alternativa digital (ver
  `src/app/layout.tsx` y `docs/arquitectura.md`).

## Reglas de uso (del Brandbook 2023)

- Nunca alterar color, proporciones ni orientación del logotipo.
- Nunca usar bordes ni fondos complejos detrás del logo.
- Respetar el área de protección (1×) y el ancho mínimo de 3 cm en
  impresión / 113 px a 96 DPI en pantalla.
- Colores de marca: Amarillo `#FCE200`, Negro `#000000`, Gris `#E1E1E1`.
  Negro suave de interfaz `#1D1D1B` (fondos oscuros, no forma parte del
  brandbook pero se usa para accesibilidad de la UI).

## Estado actual

Ningún archivo de esta lista existe todavía en el repositorio. El tema de
Tailwind (`tailwind.config.ts`) y los componentes que referencian el logo
(`src/components/brand/logo.tsx`, plantilla PDF) usan una ruta de
marcador (`/brand/logo-positivo.svg`, etc.) que debe reemplazarse por los
archivos reales antes de producción. Ver `docs/arquitectura.md` para el
inventario completo de dónde se usa cada asset.
