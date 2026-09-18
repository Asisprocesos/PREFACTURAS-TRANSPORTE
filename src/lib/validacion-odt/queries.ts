import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function buscarPrefactura(placa: string, periodoId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: vehiculo } = await supabase
    .from("vehiculo")
    .select("id")
    .eq("placa", placa.toUpperCase().replace(/[-\s]/g, ""))
    .maybeSingle();
  if (!vehiculo) return null;

  const { data: prefactura } = await supabase
    .from("prefactura")
    .select("id")
    .eq("vehiculo_id", vehiculo.id)
    .eq("periodo_id", periodoId)
    .maybeSingle();

  return prefactura?.id ?? null;
}
