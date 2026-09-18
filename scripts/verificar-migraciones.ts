/**
 * Verifica que todas las migraciones parseen como SQL de Postgres válido,
 * usando la gramática real de libpg-query. No ejecuta nada contra ninguna
 * base de datos (ni local ni remota): es un chequeo estático de sintaxis,
 * pensado para correr en CI sin depender de un proyecto Supabase real.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parse } from "libpg-query";

const DIRECTORIO_MIGRACIONES = path.join(process.cwd(), "supabase", "migrations");

async function main() {
  const archivos = (await readdir(DIRECTORIO_MIGRACIONES)).filter((f) => f.endsWith(".sql")).sort();

  if (archivos.length === 0) {
    console.error(`No se encontraron migraciones en ${DIRECTORIO_MIGRACIONES}`);
    process.exit(1);
  }

  let huboError = false;
  for (const archivo of archivos) {
    const ruta = path.join(DIRECTORIO_MIGRACIONES, archivo);
    const sql = await readFile(ruta, "utf8");
    try {
      await parse(sql);
      console.log(`OK   ${archivo}`);
    } catch (error) {
      huboError = true;
      console.error(`FAIL ${archivo}: ${(error as Error).message}`);
    }
  }

  if (huboError) process.exit(1);
  console.log(`\n${archivos.length} migración(es) verificada(s) correctamente.`);
}

main();
