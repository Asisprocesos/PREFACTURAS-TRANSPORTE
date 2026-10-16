import { requireRole } from "@/lib/auth/roles";
import { crearZipPrefacturas } from "@/lib/correo/zip";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// Best-effort: cientos de PDF a descargar de Storage y comprimir puede
// tardar bastante más que una respuesta normal. Vercel igual la recorta al
// máximo que permita el plan, pero declarar el techo más alto evita que
// Next.js la corte antes de tiempo en un plan que sí lo permite.
export const maxDuration = 300;

const TAMANO_LOTE = 500;
// Descargar cientos de PDF uno por uno de Storage sería lento (un viaje de
// red por archivo); todos a la vez arriesga saturar memoria/red. Un lote
// chico de descargas en paralelo es el punto medio.
const CONCURRENCIA_DESCARGA = 20;

function enLotes<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}

/**
 * "Descargar todos los PDF del período (ZIP)" en Repositorio: arma un único
 * ZIP con el PDF VIGENTE de cada prefactura del período (principal o
 * secundaria/ajuste), para tenerlos todos en el disco local de una sola vez
 * en vez de ir una por una con "Descargar". Reutiliza crearZipPrefacturas,
 * el mismo empaquetado que ya usa el envío consolidado a prefacturas sin
 * correo registrado.
 */
export async function GET(request: Request) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);

  const url = new URL(request.url);
  const periodoId = url.searchParams.get("periodo");
  if (!periodoId) {
    return Response.json({ error: "Debe indicar un período." }, { status: 400 });
  }

  const supabase = await createClient();

  const [{ data: periodo }, { data: prefacturasData, error: errorPrefacturas }] = await Promise.all([
    supabase.from("periodo").select("nombre").eq("id", periodoId).maybeSingle(),
    supabase.from("prefactura").select("id").eq("periodo_id", periodoId),
  ]);
  if (errorPrefacturas) {
    return Response.json({ error: "No se pudieron consultar las prefacturas del período." }, { status: 500 });
  }
  const prefacturaIds = (prefacturasData ?? []).map((p) => p.id);
  if (prefacturaIds.length === 0) {
    return Response.json({ error: "No hay prefacturas en este período." }, { status: 404 });
  }

  const documentos: { storage_key: string; nombre_archivo: string }[] = [];
  for (const lote of enLotes(prefacturaIds, TAMANO_LOTE)) {
    const { data, error } = await supabase
      .from("documento_pdf")
      .select("storage_key, nombre_archivo")
      .in("prefactura_id", lote)
      .eq("estado", "VIGENTE");
    if (error)
      return Response.json({ error: "No se pudieron consultar los PDF del período." }, { status: 500 });
    documentos.push(...(data ?? []));
  }
  if (documentos.length === 0) {
    return Response.json({ error: "No hay ningún PDF generado todavía en este período." }, { status: 404 });
  }

  const archivos: { nombreArchivo: string; contenido: Buffer }[] = [];
  for (const lote of enLotes(documentos, CONCURRENCIA_DESCARGA)) {
    const descargados = await Promise.all(
      lote.map(async (doc) => {
        const { data: blob } = await supabase.storage.from("prefacturas").download(doc.storage_key);
        if (!blob) return null;
        return { nombreArchivo: doc.nombre_archivo, contenido: Buffer.from(await blob.arrayBuffer()) };
      }),
    );
    for (const d of descargados) if (d) archivos.push(d);
  }
  if (archivos.length === 0) {
    return Response.json(
      { error: "No se pudo descargar ningún PDF desde el almacenamiento." },
      { status: 500 },
    );
  }

  const zipBuffer = await crearZipPrefacturas(archivos);
  const nombreZip = `prefacturas-${(periodo?.nombre ?? periodoId).replace(/[^\w.-]+/g, "_")}.zip`;

  return new Response(new Blob([new Uint8Array(zipBuffer)]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nombreZip}"`,
    },
  });
}
