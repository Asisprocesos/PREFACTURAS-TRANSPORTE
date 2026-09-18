"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/roles";

import { buscarPrefactura } from "./queries";

export interface EstadoBusqueda {
  error?: string;
}

export async function buscarPrefacturaAction(
  _estado: EstadoBusqueda,
  formData: FormData,
): Promise<EstadoBusqueda> {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE", "CONSULTA"]);

  const placa = String(formData.get("placa") ?? "").trim();
  const periodoId = String(formData.get("periodoId") ?? "").trim();
  if (!placa || !periodoId) {
    return { error: "Elige un período e ingresa una placa." };
  }

  const prefacturaId = await buscarPrefactura(placa, periodoId);
  if (!prefacturaId) {
    return {
      error: `No hay prefactura para la placa ${placa.toUpperCase()} en ese período. Genera las prefacturas del período primero.`,
    };
  }

  redirect(`/prefacturas/${prefacturaId}`);
}
