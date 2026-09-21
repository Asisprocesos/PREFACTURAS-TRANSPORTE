"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth/roles";
import { defaultAppConfig } from "@/config/app.config";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface ResultadoFilaMaestro {
  fila: number;
  clave: string;
  accion: "CREADO" | "ACTUALIZADO" | "ERROR";
  detalle?: string;
}

export interface ResultadoImportarMaestros {
  ok: boolean;
  error?: string;
  transportistas: ResultadoFilaMaestro[];
  vehiculos: ResultadoFilaMaestro[];
}

const REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const REGEX_RUC = /^\d{10,13}$/;

function leerBooleano(v: unknown): boolean {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  if (s === "") return true;
  return s === "SI" || s === "SÍ" || s === "TRUE" || s === "1" || s === "ACTIVO";
}

function separarCorreos(v: unknown): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function leerNumero(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

/**
 * Crea o actualiza los correos de contacto de un transportista/vehículo a
 * partir de las columnas "Correo Principal"/"Correos Adicionales" de la
 * plantilla. Solo agrega los que todavía no existen (por email, sin
 * distinguir mayúsculas) — nunca borra ni cambia un correo ya cargado, para
 * que volver a subir la misma plantilla sea seguro (idempotente).
 */
async function sincronizarCorreos(
  supabase: SupabaseServerClient,
  columnaDueno: "transportista_id" | "vehiculo_id",
  duenoId: string,
  correoPrincipal: unknown,
  correosAdicionales: unknown,
) {
  const principal = String(correoPrincipal ?? "").trim();
  const candidatos: { email: string; tipo: "PRINCIPAL" | "ADICIONAL" }[] = [];
  if (principal && REGEX_EMAIL.test(principal)) candidatos.push({ email: principal, tipo: "PRINCIPAL" });
  for (const email of separarCorreos(correosAdicionales)) {
    if (REGEX_EMAIL.test(email)) candidatos.push({ email, tipo: "ADICIONAL" });
  }
  if (candidatos.length === 0) return;

  const { data: existentes } = await supabase
    .from("contacto_correo")
    .select("email")
    .eq(columnaDueno, duenoId);
  const emailsExistentes = new Set((existentes ?? []).map((c) => c.email.toLowerCase()));
  const nuevos = candidatos.filter((c) => !emailsExistentes.has(c.email.toLowerCase()));
  if (nuevos.length === 0) return;

  await supabase.from("contacto_correo").insert(
    nuevos.map((c) => ({
      vehiculo_id: columnaDueno === "vehiculo_id" ? duenoId : null,
      transportista_id: columnaDueno === "transportista_id" ? duenoId : null,
      email: c.email,
      tipo: c.tipo,
    })),
  );
}

async function procesarTransportistas(
  supabase: SupabaseServerClient,
  hoja: XLSX.WorkSheet,
): Promise<{ resultados: ResultadoFilaMaestro[]; rucAId: Map<string, string> }> {
  const resultados: ResultadoFilaMaestro[] = [];
  const rucAId = new Map<string, string>();
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { raw: false, defval: "" });

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const numeroFila = i + 2;
    const ruc = String(fila["RUC"] ?? "").trim();
    const razonSocial = String(fila["Razón Social"] ?? "").trim();
    const nombre = String(fila["Nombre"] ?? "").trim();
    if (!ruc && !razonSocial && !nombre) continue;

    if (!REGEX_RUC.test(ruc)) {
      resultados.push({
        fila: numeroFila,
        clave: ruc || "(sin RUC)",
        accion: "ERROR",
        detalle: "RUC inválido (debe tener 10 a 13 dígitos).",
      });
      continue;
    }
    if (!razonSocial) {
      resultados.push({ fila: numeroFila, clave: ruc, accion: "ERROR", detalle: "Falta la Razón Social." });
      continue;
    }
    if (!nombre) {
      resultados.push({ fila: numeroFila, clave: ruc, accion: "ERROR", detalle: "Falta el Nombre." });
      continue;
    }

    const datos = {
      razon_social: razonSocial,
      nombre,
      tipo_transportista: String(fila["Tipo de Transportista"] ?? "").trim() || null,
      activo: leerBooleano(fila["Activo"]),
    };

    const { data: existente } = await supabase
      .from("transportista")
      .select("id")
      .eq("ruc", ruc)
      .is("deleted_at", null)
      .maybeSingle();

    let transportistaId: string;
    if (existente) {
      const { error } = await supabase.from("transportista").update(datos).eq("id", existente.id);
      if (error) {
        resultados.push({ fila: numeroFila, clave: ruc, accion: "ERROR", detalle: "No se pudo actualizar." });
        continue;
      }
      transportistaId = existente.id;
      resultados.push({ fila: numeroFila, clave: ruc, accion: "ACTUALIZADO" });
    } else {
      const { data: creado, error } = await supabase
        .from("transportista")
        .insert({ ruc, ...datos })
        .select("id")
        .single();
      if (error || !creado) {
        resultados.push({ fila: numeroFila, clave: ruc, accion: "ERROR", detalle: "No se pudo crear." });
        continue;
      }
      transportistaId = creado.id;
      resultados.push({ fila: numeroFila, clave: ruc, accion: "CREADO" });
    }

    rucAId.set(ruc, transportistaId);
    await sincronizarCorreos(
      supabase,
      "transportista_id",
      transportistaId,
      fila["Correo Principal"],
      fila["Correos Adicionales"],
    );
  }

  return { resultados, rucAId };
}

async function procesarVehiculos(
  supabase: SupabaseServerClient,
  hoja: XLSX.WorkSheet,
  rucAId: Map<string, string>,
): Promise<ResultadoFilaMaestro[]> {
  const resultados: ResultadoFilaMaestro[] = [];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { raw: false, defval: "" });

  const { data: regionales } = await supabase.from("regional").select("id, nombre").is("deleted_at", null);
  const regionalPorNombre = new Map((regionales ?? []).map((r) => [r.nombre.trim().toUpperCase(), r.id]));
  const patronPlaca = new RegExp(defaultAppConfig.patrones.placa);

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]!;
    const numeroFila = i + 2;
    const placaOriginal = String(fila["Placa"] ?? "").trim();
    if (!placaOriginal) continue;

    const placa = placaOriginal.toUpperCase().replace(/[-\s]/g, "");
    if (!patronPlaca.test(placa)) {
      resultados.push({
        fila: numeroFila,
        clave: placaOriginal,
        accion: "ERROR",
        detalle: "Placa con formato inválido.",
      });
      continue;
    }

    const rucTransportista = String(fila["RUC Transportista"] ?? "").trim();
    let transportistaId: string | null = null;
    if (rucTransportista) {
      transportistaId = rucAId.get(rucTransportista) ?? null;
      if (!transportistaId) {
        const { data } = await supabase
          .from("transportista")
          .select("id")
          .eq("ruc", rucTransportista)
          .is("deleted_at", null)
          .maybeSingle();
        transportistaId = data?.id ?? null;
      }
    }

    const regionalTexto = String(fila["Regional"] ?? "").trim();
    const regionalId = regionalTexto ? (regionalPorNombre.get(regionalTexto.toUpperCase()) ?? null) : null;

    const advertencias: string[] = [];
    if (rucTransportista && !transportistaId) advertencias.push(`no se encontró el RUC ${rucTransportista}`);
    if (regionalTexto && !regionalId) advertencias.push(`no se encontró la regional "${regionalTexto}"`);
    const detalleAdvertencia =
      advertencias.length > 0 ? `Advertencia: ${advertencias.join("; ")}.` : undefined;

    const datos = {
      transportista_id: transportistaId,
      regional_id: regionalId,
      tipo_vehiculo: String(fila["Tipo de Vehículo"] ?? "").trim() || null,
      marca: String(fila["Marca"] ?? "").trim() || null,
      modelo: String(fila["Modelo"] ?? "").trim() || null,
      anio: leerNumero(fila["Año"]),
      tonelaje: leerNumero(fila["Tonelaje"]),
      activo: leerBooleano(fila["Activo"]),
    };

    const { data: existente } = await supabase
      .from("vehiculo")
      .select("id")
      .eq("placa", placa)
      .is("deleted_at", null)
      .maybeSingle();

    let vehiculoId: string;
    if (existente) {
      const { error } = await supabase.from("vehiculo").update(datos).eq("id", existente.id);
      if (error) {
        resultados.push({
          fila: numeroFila,
          clave: placa,
          accion: "ERROR",
          detalle: "No se pudo actualizar.",
        });
        continue;
      }
      vehiculoId = existente.id;
      resultados.push({ fila: numeroFila, clave: placa, accion: "ACTUALIZADO", detalle: detalleAdvertencia });
    } else {
      const { data: creado, error } = await supabase
        .from("vehiculo")
        .insert({ placa, ...datos })
        .select("id")
        .single();
      if (error || !creado) {
        resultados.push({ fila: numeroFila, clave: placa, accion: "ERROR", detalle: "No se pudo crear." });
        continue;
      }
      vehiculoId = creado.id;
      resultados.push({ fila: numeroFila, clave: placa, accion: "CREADO", detalle: detalleAdvertencia });
    }

    await sincronizarCorreos(
      supabase,
      "vehiculo_id",
      vehiculoId,
      fila["Correo Principal"],
      fila["Correos Adicionales"],
    );
  }

  return resultados;
}

/**
 * Carga masiva de Transportistas y Vehículos desde la plantilla .xlsx
 * (ver /api/maestros/plantilla). RUC y Placa son las claves: si ya existen
 * se actualiza el registro, si no se crea uno nuevo. Los correos de
 * contacto solo se agregan (nunca se borran ni se pisan) para que volver a
 * subir el mismo archivo sea seguro.
 */
export async function importarMaestrosAction(formData: FormData): Promise<ResultadoImportarMaestros> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    return { ok: false, error: "No se recibió ningún archivo.", transportistas: [], vehiculos: [] };
  }

  try {
    const buffer = await archivo.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const hojaTransportistas = workbook.Sheets["Transportistas"];
    const hojaVehiculos = workbook.Sheets["Vehiculos"];
    if (!hojaTransportistas && !hojaVehiculos) {
      return {
        ok: false,
        error: 'El archivo no tiene hojas "Transportistas" ni "Vehiculos". Usa la plantilla.',
        transportistas: [],
        vehiculos: [],
      };
    }

    const supabase = await createClient();

    let transportistas: ResultadoFilaMaestro[] = [];
    let rucAId = new Map<string, string>();
    if (hojaTransportistas) {
      const resultado = await procesarTransportistas(supabase, hojaTransportistas);
      transportistas = resultado.resultados;
      rucAId = resultado.rucAId;
    }

    let vehiculos: ResultadoFilaMaestro[] = [];
    if (hojaVehiculos) {
      vehiculos = await procesarVehiculos(supabase, hojaVehiculos, rucAId);
    }

    revalidatePath("/transportistas");
    revalidatePath("/vehiculos");

    return { ok: true, transportistas, vehiculos };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido procesando el archivo.";
    return { ok: false, error: mensaje, transportistas: [], vehiculos: [] };
  }
}
