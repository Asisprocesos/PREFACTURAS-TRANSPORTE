#!/usr/bin/env tsx
/**
 * Migra los maestros (transportistas, vehículos, conductores y correos de
 * contacto) desde las hojas VEHICULOS y BD CORREOS del macro
 * `docs/fuentes/MACRO_CORTE_13_JUL_-_12_AGO.xlsb` hacia Supabase.
 *
 * No asume los nombres exactos de columna: para cada campo interno prueba
 * una lista de alias conocidos (ver ALIAS_VEHICULOS/ALIAS_CORREOS) y reporta
 * como conflicto cualquier columna que no logre mapear.
 *
 * Modo por defecto: DRY-RUN. Genera `docs/migracion-maestros-reporte.md`
 * con lo que se migraría y los conflictos encontrados, pero no escribe en
 * la base de datos. Pasa `--aplicar` para ejecutar los upserts reales
 * (requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el
 * entorno — nunca corre nada sin que el operador lo pida explícitamente).
 *
 * Uso:
 *   npm run migrar:maestros            # dry-run, genera el reporte
 *   npm run migrar:maestros -- --aplicar   # aplica los cambios en Supabase
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

const ARCHIVO = join(process.cwd(), "docs", "fuentes", "MACRO_CORTE_13_JUL_-_12_AGO.xlsb");
const REPORTE = join(process.cwd(), "docs", "migracion-maestros-reporte.md");
const APLICAR = process.argv.includes("--aplicar");

// Alias conocidos por campo interno. Se prueban en orden, sin distinguir
// mayúsculas/acentos exactos (ver `normalizarEncabezado`).
const ALIAS_VEHICULOS: Record<string, string[]> = {
  placa: ["placasvehiculo", "placas vehiculo", "placa", "vehiculo", "placa vehiculo"],
  ruc: ["ruc"],
  contratista: ["contratista", "razon social", "razonsocial"],
  propietario: ["propietario"],
  conductor: ["conductor"],
  marca: ["marca"],
  modelo: ["modelo"],
  anio: ["año", "anio", "ano"],
  tonelaje: ["tonelaje"],
  tipoVehiculo: ["tipo vehiculo", "tipovehiculo"],
  largo: ["largo"],
  alto: ["alto"],
  ancho: ["ancho"],
  cubicaje: ["cubicaje"],
  regional: ["regional"],
  tipoTransportista: ["tipo transportista", "tipotransportista"],
  correo: ["correo", "email"],
};

const ALIAS_CORREOS: Record<string, string[]> = {
  placa: ["placa"],
  estado: ["estado"],
  correos: ["correos", "correo", "email", "emails"],
  contratista: ["contratista"],
};

interface FilaCruda {
  [columna: string]: unknown;
}

interface Conflicto {
  hoja: string;
  fila: number;
  motivo: string;
}

function normalizarEncabezado(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .trim();
}

function mapearEncabezados(encabezados: string[], alias: Record<string, string[]>) {
  const normalizados = encabezados.map(normalizarEncabezado);
  const mapa: Record<string, number> = {};
  const sinMapear: string[] = [];

  for (const [campo, candidatos] of Object.entries(alias)) {
    const idx = normalizados.findIndex((h) => candidatos.includes(h));
    if (idx >= 0) mapa[campo] = idx;
  }

  normalizados.forEach((h, i) => {
    if (!Object.values(mapa).includes(i) && h) sinMapear.push(encabezados[i] ?? h);
  });

  return { mapa, sinMapear };
}

function leerHoja(wb: XLSX.WorkBook, nombre: string): { encabezados: string[]; filas: FilaCruda[] } | null {
  const nombreReal = wb.SheetNames.find((n) => normalizarEncabezado(n) === normalizarEncabezado(nombre));
  if (!nombreReal) return null;

  const hoja = wb.Sheets[nombreReal];
  if (!hoja) return null;

  const filas: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" });
  const encabezados = (filas[0] ?? []).map((h) => String(h ?? "").trim());
  const cuerpo = filas.slice(1).map((fila) => {
    const obj: FilaCruda = {};
    encabezados.forEach((h, i) => (obj[h] = fila[i]));
    return obj;
  });

  return { encabezados, filas: cuerpo };
}

function valorPorIndice(fila: unknown[], indice: number | undefined): string {
  if (indice === undefined) return "";
  return String(fila[indice] ?? "").trim();
}

interface VehiculoMigrado {
  placa: string;
  transportistaRuc: string | null;
  propietario: string | null;
  conductor: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  tonelaje: number | null;
  tipoVehiculo: string | null;
  largo: number | null;
  alto: number | null;
  ancho: number | null;
  cubicaje: number | null;
  regional: string | null;
  correoDirecto: string | null;
}

interface TransportistaMigrado {
  ruc: string;
  razonSocial: string;
  tipoTransportista: string | null;
}

function procesarVehiculos(wb: XLSX.WorkBook, conflictos: Conflicto[]) {
  const hoja = leerHoja(wb, "VEHICULOS");
  const vehiculos: VehiculoMigrado[] = [];
  const transportistas = new Map<string, TransportistaMigrado>();

  if (!hoja) {
    conflictos.push({ hoja: "VEHICULOS", fila: 0, motivo: "No se encontró la hoja VEHICULOS en el libro." });
    return { vehiculos, transportistas };
  }

  const { mapa, sinMapear } = mapearEncabezados(hoja.encabezados, ALIAS_VEHICULOS);
  for (const col of sinMapear) {
    conflictos.push({ hoja: "VEHICULOS", fila: 0, motivo: `Columna sin mapear: "${col}"` });
  }

  const filasCrudas: unknown[][] = hoja.filas.map((f) => hoja.encabezados.map((h) => f[h]));

  filasCrudas.forEach((fila, i) => {
    const numeroFila = i + 2; // +1 por encabezado, +1 por índice base 1
    const placa = valorPorIndice(fila, mapa.placa)
      .toUpperCase()
      .replace(/[-\s]/g, "");
    if (!placa) {
      conflictos.push({ hoja: "VEHICULOS", fila: numeroFila, motivo: "Fila sin placa, se omite." });
      return;
    }

    const ruc = valorPorIndice(fila, mapa.ruc);
    const contratista = valorPorIndice(fila, mapa.contratista);
    if (ruc && !contratista) {
      conflictos.push({ hoja: "VEHICULOS", fila: numeroFila, motivo: `Placa ${placa}: RUC sin razón social.` });
    }
    if (contratista && !ruc) {
      conflictos.push({ hoja: "VEHICULOS", fila: numeroFila, motivo: `Placa ${placa}: razón social sin RUC, no se puede migrar el transportista.` });
    }
    if (ruc && contratista && !transportistas.has(ruc)) {
      transportistas.set(ruc, {
        ruc,
        razonSocial: contratista,
        tipoTransportista: valorPorIndice(fila, mapa.tipoTransportista) || null,
      });
    }

    const numero = (campo: string) => {
      const v = valorPorIndice(fila, mapa[campo]);
      const n = Number(v.replace(",", "."));
      return v && !Number.isNaN(n) ? n : null;
    };

    vehiculos.push({
      placa,
      transportistaRuc: ruc || null,
      propietario: valorPorIndice(fila, mapa.propietario) || null,
      conductor: valorPorIndice(fila, mapa.conductor) || null,
      marca: valorPorIndice(fila, mapa.marca) || null,
      modelo: valorPorIndice(fila, mapa.modelo) || null,
      anio: numero("anio"),
      tonelaje: numero("tonelaje"),
      tipoVehiculo: valorPorIndice(fila, mapa.tipoVehiculo) || null,
      largo: numero("largo"),
      alto: numero("alto"),
      ancho: numero("ancho"),
      cubicaje: numero("cubicaje"),
      regional: valorPorIndice(fila, mapa.regional) || null,
      correoDirecto: valorPorIndice(fila, mapa.correo) || null,
    });
  });

  return { vehiculos, transportistas };
}

interface CorreoMigrado {
  placa: string;
  email: string;
}

function procesarCorreos(wb: XLSX.WorkBook, conflictos: Conflicto[]): CorreoMigrado[] {
  const hoja = leerHoja(wb, "BD CORREOS");
  const correos: CorreoMigrado[] = [];

  if (!hoja) {
    conflictos.push({ hoja: "BD CORREOS", fila: 0, motivo: "No se encontró la hoja BD CORREOS en el libro." });
    return correos;
  }

  const { mapa, sinMapear } = mapearEncabezados(hoja.encabezados, ALIAS_CORREOS);
  for (const col of sinMapear) {
    conflictos.push({ hoja: "BD CORREOS", fila: 0, motivo: `Columna sin mapear: "${col}"` });
  }

  const filasCrudas: unknown[][] = hoja.filas.map((f) => hoja.encabezados.map((h) => f[h]));
  const vistos = new Set<string>();

  filasCrudas.forEach((fila, i) => {
    const numeroFila = i + 2;
    const placa = valorPorIndice(fila, mapa.placa)
      .toUpperCase()
      .replace(/[-\s]/g, "");
    const estado = valorPorIndice(fila, mapa.estado).toUpperCase();
    const crudos = valorPorIndice(fila, mapa.correos);

    if (!placa) return;
    if (estado.includes("NO TIENE") || !crudos) {
      conflictos.push({ hoja: "BD CORREOS", fila: numeroFila, motivo: `Placa ${placa}: sin correo ("${estado}").` });
      return;
    }

    for (const emailCrudo of crudos.split(";")) {
      const email = emailCrudo.trim().toLowerCase();
      if (!email) continue;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        conflictos.push({ hoja: "BD CORREOS", fila: numeroFila, motivo: `Placa ${placa}: correo con formato inválido "${email}".` });
        continue;
      }
      const clave = `${placa}:${email}`;
      if (vistos.has(clave)) continue; // deduplicar (la hoja trae duplicados)
      vistos.add(clave);
      correos.push({ placa, email });
    }
  });

  return correos;
}

function generarReporte(
  vehiculos: VehiculoMigrado[],
  transportistas: Map<string, TransportistaMigrado>,
  correos: CorreoMigrado[],
  conflictos: Conflicto[],
  aplicado: boolean,
) {
  const lineas: string[] = [];
  lineas.push("# Reporte de migración de maestros");
  lineas.push("");
  lineas.push(`Generado: ${new Date().toISOString()}`);
  lineas.push(`Modo: ${aplicado ? "APLICADO (escrito en Supabase)" : "DRY-RUN (no se escribió nada)"}`);
  lineas.push("");
  lineas.push("## Resumen");
  lineas.push("");
  lineas.push(`- Transportistas detectados: ${transportistas.size}`);
  lineas.push(`- Vehículos detectados: ${vehiculos.length}`);
  lineas.push(`- Correos detectados (deduplicados): ${correos.length}`);
  lineas.push(`- Conflictos: ${conflictos.length}`);
  lineas.push("");
  lineas.push("## Conflictos");
  lineas.push("");
  if (conflictos.length === 0) {
    lineas.push("Ninguno.");
  } else {
    lineas.push("| Hoja | Fila | Motivo |");
    lineas.push("|---|---|---|");
    for (const c of conflictos) {
      lineas.push(`| ${c.hoja} | ${c.fila || "-"} | ${c.motivo} |`);
    }
  }
  lineas.push("");
  writeFileSync(REPORTE, lineas.join("\n"), "utf-8");
}

async function aplicarEnSupabase(
  vehiculos: VehiculoMigrado[],
  transportistas: Map<string, TransportistaMigrado>,
  correos: CorreoMigrado[],
) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para aplicar la migración.");
  }
  const supabase = createClient(url, key);

  console.log(`Aplicando ${transportistas.size} transportistas...`);
  for (const t of transportistas.values()) {
    const { error } = await supabase
      .from("transportista")
      .upsert({ ruc: t.ruc, razon_social: t.razonSocial, tipo_transportista: t.tipoTransportista }, { onConflict: "ruc" });
    if (error) console.error(`  Error transportista RUC ${t.ruc}: ${error.message}`);
  }

  const rucAId = new Map<string, string>();
  {
    const { data } = await supabase.from("transportista").select("id, ruc");
    for (const row of data ?? []) rucAId.set(row.ruc, row.id);
  }

  console.log(`Aplicando ${vehiculos.length} vehículos...`);
  for (const v of vehiculos) {
    const { error } = await supabase.from("vehiculo").upsert(
      {
        placa: v.placa,
        transportista_id: v.transportistaRuc ? (rucAId.get(v.transportistaRuc) ?? null) : null,
        propietario: v.propietario,
        marca: v.marca,
        modelo: v.modelo,
        anio: v.anio,
        tonelaje: v.tonelaje,
        tipo_vehiculo: v.tipoVehiculo,
        largo: v.largo,
        alto: v.alto,
        ancho: v.ancho,
        cubicaje: v.cubicaje,
      },
      { onConflict: "placa" },
    );
    if (error) console.error(`  Error vehículo ${v.placa}: ${error.message}`);
  }

  const placaAId = new Map<string, string>();
  {
    const { data } = await supabase.from("vehiculo").select("id, placa");
    for (const row of data ?? []) placaAId.set(row.placa, row.id);
  }

  console.log(`Aplicando ${correos.length} correos...`);
  for (const c of correos) {
    const vehiculoId = placaAId.get(c.placa);
    if (!vehiculoId) continue;
    const { error } = await supabase
      .from("contacto_correo")
      .upsert({ vehiculo_id: vehiculoId, email: c.email, tipo: "PRINCIPAL" }, { onConflict: "vehiculo_id,email" });
    if (error) console.error(`  Error correo ${c.email} (${c.placa}): ${error.message}`);
  }
}

async function main() {
  if (!existsSync(ARCHIVO)) {
    console.log(
      `No se encontró ${ARCHIVO}. Este script no genera reporte porque no hay nada que migrar. ` +
        "Ver docs/fuentes/README.md.",
    );
    return;
  }

  const buf = readFileSync(ARCHIVO);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  const conflictos: Conflicto[] = [];
  const { vehiculos, transportistas } = procesarVehiculos(wb, conflictos);
  const correos = procesarCorreos(wb, conflictos);

  if (APLICAR) {
    await aplicarEnSupabase(vehiculos, transportistas, correos);
  }

  generarReporte(vehiculos, transportistas, correos, conflictos, APLICAR);
  console.log(`Reporte escrito en ${REPORTE}`);
  if (!APLICAR) {
    console.log("Dry-run: no se escribió nada en Supabase. Vuelve a correr con --aplicar para migrar de verdad.");
  }
}

main();
