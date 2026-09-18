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

  test("no envía el formulario con un correo inválido (validación nativa)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo corporativo").fill("no-es-un-correo");
    await page.getByLabel("Contraseña").fill("cualquier-cosa");
    await page.getByRole("button", { name: "Ingresar" }).click();
    // El navegador bloquea el submit antes de llegar al Server Action:
    // seguimos en /login y el campo queda marcado como inválido.
    await expect(page).toHaveURL(/\/login$/);
    const valido = await page
      .getByLabel("Correo corporativo")
      .evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valido).toBe(false);
  });
});
