import { incrementarProgresoLoteAction } from "@/lib/ejecuciones/actions";

export interface PrefacturaPdfPendiente {
  id: string;
  numero: string | null;
}

export interface ProgresoPdf {
  total: number;
  hechos: number;
  exitosos: number;
  errores: { numero: string; error: string }[];
}

/**
 * Loop compartido por "Generar todos los PDF del período" y "Generar PDFs
 * seleccionados": genera un PDF a la vez y persiste el progreso en el lote
 * (vía incrementar_progreso_lote) para que sea visible en /ejecuciones y
 * cancelable aunque el usuario cambie de pantalla a mitad de camino.
 * `hechosPrevios` es distinto de cero solo al retomar un lote existente.
 */
export async function ejecutarLotePdf({
  loteId,
  pendientes,
  hechosPrevios = 0,
  canceladoRef,
  onProgreso,
}: {
  loteId: string;
  pendientes: PrefacturaPdfPendiente[];
  hechosPrevios?: number;
  canceladoRef: { current: boolean };
  onProgreso: (progreso: ProgresoPdf) => void;
}): Promise<ProgresoPdf> {
  const errores: ProgresoPdf["errores"] = [];
  let exitosos = 0;
  let procesados = 0;
  const total = hechosPrevios + pendientes.length;

  for (let i = 0; i < pendientes.length; i++) {
    if (canceladoRef.current) break;
    const prefactura = pendientes[i]!;
    onProgreso({ total, hechos: hechosPrevios + i, exitosos, errores });

    let exito = false;
    try {
      const respuesta = await fetch(`/api/prefacturas/${prefactura.id}/pdf`, { method: "POST" });
      const cuerpo = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        errores.push({
          numero: prefactura.numero ?? prefactura.id,
          error: cuerpo?.error ?? `HTTP ${respuesta.status}`,
        });
      } else {
        exitosos++;
        exito = true;
      }
    } catch {
      errores.push({
        numero: prefactura.numero ?? prefactura.id,
        error: "Se perdió la conexión con el servidor.",
      });
    }
    await incrementarProgresoLoteAction(loteId, exito);
    procesados++;
  }

  const final = { total, hechos: hechosPrevios + procesados, exitosos, errores };
  onProgreso(final);
  return final;
}
