import { notFound, redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/roles";
import { obtenerVehiculoIdPorPlaca } from "@/lib/vehiculos/queries";

/**
 * Redirección server-side: el enlace "Corregir" de una advertencia de
 * importación conoce la placa, no el id del vehículo. Evita duplicar la
 * búsqueda por placa en un componente cliente aparte.
 */
export default async function VehiculoPorPlacaPage({
  params,
  searchParams,
}: {
  params: Promise<{ placa: string }>;
  searchParams: Promise<{ volver?: string }>;
}) {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);
  const { placa } = await params;
  const { volver } = await searchParams;

  const id = await obtenerVehiculoIdPorPlaca(placa.toUpperCase());
  if (!id) notFound();

  const destino = volver
    ? `/vehiculos/${id}?volver=${encodeURIComponent(volver)}#correos`
    : `/vehiculos/${id}#correos`;
  redirect(destino);
}
