"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

import { requireRole } from "@/lib/auth/roles";
import { defaultAppConfig } from "@/config/app.config";
import { createClient } from "@/lib/supabase/server";
import { asignarConductorSiCambio } from "@/lib/vehiculos/conductor";
import type { Database } from "@/types/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type CambiosTransportista = Database["public"]["Tables"]["transportista"]["Update"];

export interface ResultadoFilaMaestro {
  fila: number;
  clave: string;
  accion: "CREADO" | "ACTUALIZADO" | "ERROR";
  detalle?: string;
}

export interface FilaVehiculoAImportar {
  numeroFila: number;
  datos: Record<string, unknown>;
}

export interface ResultadoAnalisisArchivo {
  ok: boolean;
  error?: string;
  filas: FilaVehiculoAImportar[];
}

export interface ResultadoImportarLote {
  ok: boolean;
  error?: string;
  resultados: ResultadoFilaMaestro[];
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
 * Solo lee y valida la hoja del archivo (rápido, sin escribir nada en la
 * base de datos): separado de importarLoteVehiculosAction para que el
 * cliente pueda partir las filas en lotes pequeños y procesarlas una a una.
 * Un archivo con muchas filas en un solo request corría el riesgo de
 * exceder el límite de duración de la función serverless a mitad de
 * camino, sin devolver ninguna respuesta.
 */
export async function analizarArchivoVehiculosAction(formData: FormData): Promise<ResultadoAnalisisArchivo> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    return { ok: false, error: "No se recibió ningún archivo.", filas: [] };
  }

  try {
    const buffer = await archivo.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const hoja = workbook.Sheets["Vehiculos"];
    if (!hoja) {
      return { ok: false, error: 'El archivo no tiene la hoja "Vehiculos". Usa la plantilla.', filas: [] };
    }

    const filasHoja = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { raw: false, defval: "" });
    const filas = filasHoja.map((datos, i) => ({ numeroFila: i + 2, datos }));
    return { ok: true, filas };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido leyendo el archivo.";
    return { ok: false, error: mensaje, filas: [] };
  }
}

/**
 * Crea o actualiza los correos de contacto de un transportista/vehículo a
 * partir de columnas "Correo .../Correos Adicionales ..." de la plantilla.
 * Solo agrega los que todavía no existen (por email, sin distinguir
 * mayúsculas) — nunca borra ni cambia un correo ya cargado, para que volver
 * a subir la misma plantilla sea seguro (idempotente).
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

/**
 * Resuelve (creando o actualizando si hace falta) el transportista de una
 * fila a partir de su RUC. Cachea por RUC dentro del lote: si el mismo
 * transportista se repite en varias filas del mismo lote (varios
 * vehículos), solo se consulta/escribe una vez. Al actualizar un
 * transportista existente, solo se pisan los campos que vengan llenos en la
 * fila (una celda vacía no borra el dato ya guardado).
 */
async function resolverTransportistaDeFila(
  supabase: SupabaseServerClient,
  fila: Record<string, unknown>,
  cache: Map<string, string>,
): Promise<{ transportistaId: string | null; advertencia?: string }> {
  const ruc = String(fila["RUC Transportista"] ?? "").trim();
  if (!ruc) return { transportistaId: null };

  const idCacheado = cache.get(ruc);
  if (idCacheado) return { transportistaId: idCacheado };

  if (!REGEX_RUC.test(ruc)) {
    return { transportistaId: null, advertencia: `RUC Transportista "${ruc}" inválido, no se asoció.` };
  }

  const razonSocial = String(fila["Razón Social Transportista"] ?? "").trim();
  const nombre = String(fila["Nombre Transportista"] ?? "").trim();
  const tipoTransportista = String(fila["Tipo de Transportista"] ?? "").trim();

  const { data: existente } = await supabase
    .from("transportista")
    .select("id")
    .eq("ruc", ruc)
    .is("deleted_at", null)
    .maybeSingle();

  let transportistaId: string;
  if (existente) {
    const cambios: CambiosTransportista = { activo: leerBooleano(fila["Activo Transportista"]) };
    if (razonSocial) cambios.razon_social = razonSocial;
    if (nombre) cambios.nombre = nombre;
    if (tipoTransportista) cambios.tipo_transportista = tipoTransportista;
    await supabase.from("transportista").update(cambios).eq("id", existente.id);
    transportistaId = existente.id;
  } else if (razonSocial && nombre) {
    const { data: creado, error } = await supabase
      .from("transportista")
      .insert({
        ruc,
        razon_social: razonSocial,
        nombre,
        tipo_transportista: tipoTransportista || null,
        activo: leerBooleano(fila["Activo Transportista"]),
      })
      .select("id")
      .single();
    if (error || !creado) {
      return { transportistaId: null, advertencia: `no se pudo crear el transportista con RUC ${ruc}.` };
    }
    transportistaId = creado.id;
  } else {
    return {
      transportistaId: null,
      advertencia: `el RUC ${ruc} no existe y faltan Razón Social/Nombre Transportista para crearlo.`,
    };
  }

  cache.set(ruc, transportistaId);
  await sincronizarCorreos(
    supabase,
    "transportista_id",
    transportistaId,
    fila["Correo Transportista"],
    fila["Correos Adicionales Transportista"],
  );
  return { transportistaId };
}

async function procesarFilaVehiculo(
  supabase: SupabaseServerClient,
  numeroFila: number,
  fila: Record<string, unknown>,
  regionalPorNombre: Map<string, string>,
  patronPlaca: RegExp,
  transportistaPorRuc: Map<string, string>,
): Promise<ResultadoFilaMaestro | null> {
  const placaOriginal = String(fila["Placa"] ?? "").trim();
  if (!placaOriginal) return null;

  const placa = placaOriginal.toUpperCase().replace(/[-\s]/g, "");
  if (!patronPlaca.test(placa)) {
    return {
      fila: numeroFila,
      clave: placaOriginal,
      accion: "ERROR",
      detalle: "Placa con formato inválido.",
    };
  }

  const advertencias: string[] = [];

  const { transportistaId, advertencia: advertenciaTransportista } = await resolverTransportistaDeFila(
    supabase,
    fila,
    transportistaPorRuc,
  );
  if (advertenciaTransportista) advertencias.push(advertenciaTransportista);

  const regionalTexto = String(fila["Regional"] ?? "").trim();
  const regionalId = regionalTexto ? (regionalPorNombre.get(regionalTexto.toUpperCase()) ?? null) : null;
  if (regionalTexto && !regionalId) advertencias.push(`no se encontró la regional "${regionalTexto}".`);

  const datos = {
    transportista_id: transportistaId,
    regional_id: regionalId,
    tipo_vehiculo: String(fila["Tipo de Vehículo"] ?? "").trim() || null,
    marca: String(fila["Marca"] ?? "").trim() || null,
    modelo: String(fila["Modelo"] ?? "").trim() || null,
    anio: leerNumero(fila["Año"]),
    tonelaje: leerNumero(fila["Tonelaje"]),
    propietario: String(fila["Propietario"] ?? "").trim() || null,
    ruc_propietario: String(fila["RUC del Propietario"] ?? "").trim() || null,
    activo: leerBooleano(fila["Activo Vehículo"]),
  };

  const { data: existente } = await supabase
    .from("vehiculo")
    .select("id")
    .eq("placa", placa)
    .is("deleted_at", null)
    .maybeSingle();

  let vehiculoId: string;
  let accion: "CREADO" | "ACTUALIZADO";
  if (existente) {
    const { error } = await supabase.from("vehiculo").update(datos).eq("id", existente.id);
    if (error) {
      return {
        fila: numeroFila,
        clave: placa,
        accion: "ERROR",
        detalle: "No se pudo actualizar el vehículo.",
      };
    }
    vehiculoId = existente.id;
    accion = "ACTUALIZADO";
  } else {
    const { data: creado, error } = await supabase
      .from("vehiculo")
      .insert({ placa, ...datos })
      .select("id")
      .single();
    if (error || !creado) {
      return { fila: numeroFila, clave: placa, accion: "ERROR", detalle: "No se pudo crear el vehículo." };
    }
    vehiculoId = creado.id;
    accion = "CREADO";
  }

  const nombreConductor = String(fila["Nombre del Conductor"] ?? "").trim();
  if (nombreConductor) {
    const resultadoConductor = await asignarConductorSiCambio(supabase, vehiculoId, nombreConductor);
    if (!resultadoConductor.ok) {
      advertencias.push(`no se pudo registrar el conductor: ${resultadoConductor.error}`);
    }
  }

  await sincronizarCorreos(
    supabase,
    "vehiculo_id",
    vehiculoId,
    fila["Correo Vehículo"],
    fila["Correos Adicionales Vehículo"],
  );

  const detalleAdvertencia = advertencias.length > 0 ? `Advertencia: ${advertencias.join("; ")}` : undefined;
  return { fila: numeroFila, clave: placa, accion, detalle: detalleAdvertencia };
}

/**
 * Procesa un lote pequeño (pensado para ~5 filas) ya parsadas del archivo —
 * el cliente llama esta acción una vez por lote, en secuencia, mostrando
 * progreso entre cada llamada. Cada llamada es independiente y rápida, así
 * que un archivo con muchas filas nunca depende de que una sola función
 * serverless aguante todo el trabajo de punta a punta.
 */
export async function importarLoteVehiculosAction(
  lote: FilaVehiculoAImportar[],
): Promise<ResultadoImportarLote> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);
  if (lote.length === 0) return { ok: true, resultados: [] };

  try {
    const supabase = await createClient();
    const { data: regionales } = await supabase.from("regional").select("id, nombre").is("deleted_at", null);
    const regionalPorNombre = new Map((regionales ?? []).map((r) => [r.nombre.trim().toUpperCase(), r.id]));
    const patronPlaca = new RegExp(defaultAppConfig.patrones.placa);
    const transportistaPorRuc = new Map<string, string>();

    const resultados: ResultadoFilaMaestro[] = [];
    for (const { numeroFila, datos } of lote) {
      const resultado = await procesarFilaVehiculo(
        supabase,
        numeroFila,
        datos,
        regionalPorNombre,
        patronPlaca,
        transportistaPorRuc,
      );
      if (resultado) resultados.push(resultado);
    }

    revalidatePath("/transportistas");
    revalidatePath("/vehiculos");

    return { ok: true, resultados };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido procesando el lote.";
    return { ok: false, error: mensaje, resultados: [] };
  }
}
