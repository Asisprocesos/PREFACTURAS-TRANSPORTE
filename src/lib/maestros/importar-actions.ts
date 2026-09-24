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

export interface ResultadoImportarMaestros {
  ok: boolean;
  error?: string;
  filas: ResultadoFilaMaestro[];
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
 * fila a partir de su RUC. Cachea por RUC dentro de la corrida: si el mismo
 * transportista se repite en varias filas (varios vehículos), solo se
 * consulta/escribe una vez — las filas siguientes con ese RUC reutilizan el
 * id ya resuelto sin necesidad de repetir Razón Social/Nombre. Al
 * actualizar un transportista existente, solo se pisan los campos que
 * vengan llenos en la fila (una celda vacía no borra el dato ya guardado).
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

async function procesarVehiculos(
  supabase: SupabaseServerClient,
  hoja: XLSX.WorkSheet,
): Promise<ResultadoFilaMaestro[]> {
  const resultados: ResultadoFilaMaestro[] = [];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { raw: false, defval: "" });

  const { data: regionales } = await supabase.from("regional").select("id, nombre").is("deleted_at", null);
  const regionalPorNombre = new Map((regionales ?? []).map((r) => [r.nombre.trim().toUpperCase(), r.id]));
  const patronPlaca = new RegExp(defaultAppConfig.patrones.placa);
  const transportistaPorRuc = new Map<string, string>();

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
        resultados.push({
          fila: numeroFila,
          clave: placa,
          accion: "ERROR",
          detalle: "No se pudo actualizar el vehículo.",
        });
        continue;
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
        resultados.push({
          fila: numeroFila,
          clave: placa,
          accion: "ERROR",
          detalle: "No se pudo crear el vehículo.",
        });
        continue;
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

    const detalleAdvertencia =
      advertencias.length > 0 ? `Advertencia: ${advertencias.join("; ")}` : undefined;
    resultados.push({ fila: numeroFila, clave: placa, accion, detalle: detalleAdvertencia });
  }

  return resultados;
}

/**
 * Carga masiva unificada de Vehículos (transportista + vehículo + conductor
 * en una sola fila) desde la plantilla .xlsx (ver /api/maestros/plantilla).
 * Placa es la clave del vehículo y RUC Transportista la del transportista:
 * si ya existen se actualizan sus datos, si no, se crean. Los correos de
 * contacto solo se agregan, nunca se borran.
 */
export async function importarMaestrosAction(formData: FormData): Promise<ResultadoImportarMaestros> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    return { ok: false, error: "No se recibió ningún archivo.", filas: [] };
  }

  try {
    const buffer = await archivo.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const hojaVehiculos = workbook.Sheets["Vehiculos"];
    if (!hojaVehiculos) {
      return {
        ok: false,
        error: 'El archivo no tiene la hoja "Vehiculos". Usa la plantilla.',
        filas: [],
      };
    }

    const supabase = await createClient();
    const filas = await procesarVehiculos(supabase, hojaVehiculos);

    revalidatePath("/transportistas");
    revalidatePath("/vehiculos");

    return { ok: true, filas };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido procesando el archivo.";
    return { ok: false, error: mensaje, filas: [] };
  }
}
