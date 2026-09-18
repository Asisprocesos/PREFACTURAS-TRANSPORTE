import { expect, test } from "@playwright/test";

/**
 * Smoke test: la pantalla de login carga y exige credenciales.
 * Los escenarios de autenticación real y el flujo E2E completo (importar →
 * validar → generar prefacturas → PDF → enviar) requieren un proyecto
 * Supabase de pruebas y se completan en la fase de Pruebas (ver
 * docs/arquitectura.md, sección 9).
 */
test.describe("Login", () => {
  test("redirige a /login cuando no hay sesión", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("muestra el formulario de acceso", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Correo corporativo")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  });
});
