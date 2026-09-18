import { expect, test } from "@playwright/test";

/**
 * Smoke test de middleware: cualquier ruta bajo (app) exige sesión y
 * redirige a /login conservando `redirectTo`. No requiere un proyecto
 * Supabase real (la request nunca llega a autenticar), solo valida que el
 * middleware y el layout protegido funcionan para cada módulo entregado.
 */
const RUTAS_PROTEGIDAS = [
  "/dashboard",
  "/buscador",
  "/prefacturas",
  "/importar",
  "/control-placa",
  "/validacion-odt",
  "/transportistas",
  "/vehiculos",
  "/repositorio",
  "/historial",
  "/reportes",
  "/usuarios",
  "/configuracion",
];

test.describe("Rutas protegidas", () => {
  for (const ruta of RUTAS_PROTEGIDAS) {
    test(`${ruta} redirige a /login sin sesión`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/login\?redirectTo=/);
    });
  }
});
