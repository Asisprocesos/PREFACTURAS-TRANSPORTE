import type { EntradaAuditoria } from "@/lib/auditoria/queries";

/**
 * Helpers de presentación puros (sin acceso a datos), separados de queries.ts
 * porque ese archivo importa "server-only" y estos se usan también desde
 * componentes cliente (filtros.tsx, tabla.tsx).
 */
type FilaJson = Record<string, unknown>;

/** Tablas con auditoría genérica activa (ver migraciones triggers_negocio y auditoria_tablas_faltantes), con etiqueta en español para filtros/listado. */
export const TABLAS_AUDITADAS: { valor: string; etiqueta: string }[] = [
  { valor: "odt", etiqueta: "ODT" },
  { valor: "prefactura", etiqueta: "Prefactura" },
  { valor: "documento_pdf", etiqueta: "Documento PDF" },
  { valor: "envio_correo", etiqueta: "Envío de correo" },
  { valor: "vehiculo", etiqueta: "Vehículo" },
  { valor: "transportista", etiqueta: "Transportista" },
  { valor: "perfil_usuario", etiqueta: "Usuario (rol/estado)" },
  { valor: "configuracion", etiqueta: "Configuración" },
  { valor: "conductor", etiqueta: "Conductor" },
  { valor: "vehiculo_conductor", etiqueta: "Asignación conductor-vehículo" },
  { valor: "contacto_correo", etiqueta: "Contacto de correo" },
  { valor: "periodo", etiqueta: "Período" },
  { valor: "regional", etiqueta: "Regional" },
  { valor: "tipo_ruta_centro_costo", etiqueta: "Tipo de ruta → Centro de costo" },
  { valor: "descuento", etiqueta: "Descuento" },
];

const ETIQUETAS_ACCION: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Modificación",
  DELETE: "Eliminación",
};

export function etiquetaAccion(accion: string): string {
  return ETIQUETAS_ACCION[accion] ?? accion;
}

export function etiquetaTabla(tabla: string): string {
  return TABLAS_AUDITADAS.find((t) => t.valor === tabla)?.etiqueta ?? tabla;
}

/** Identificador legible + enlace de detalle (si existe esa pantalla) para la fila afectada por un evento de auditoría. */
export function descripcionRegistro(
  entrada: Pick<EntradaAuditoria, "tabla" | "registro_id" | "antes" | "despues">,
): { titulo: string; href?: string } {
  const fila = (entrada.despues ?? entrada.antes) as FilaJson | null;
  const id = entrada.registro_id;

  switch (entrada.tabla) {
    case "odt": {
      const guia = (fila?.guia as string | undefined) ?? id ?? "—";
      return { titulo: guia, href: `/odt/${encodeURIComponent(guia)}/corregir` };
    }
    case "prefactura":
      return {
        titulo: (fila?.numero as string | undefined) ?? id ?? "—",
        href: id ? `/prefacturas/${id}` : undefined,
      };
    case "documento_pdf": {
      const prefacturaId = fila?.prefactura_id as string | undefined;
      const version = fila?.version as number | undefined;
      return {
        titulo: version ? `Versión ${version}` : (id ?? "—"),
        href: prefacturaId ? `/prefacturas/${prefacturaId}` : undefined,
      };
    }
    case "envio_correo": {
      const prefacturaId = fila?.prefactura_id as string | undefined;
      return {
        titulo: (fila?.asunto as string | undefined) ?? id ?? "—",
        href: prefacturaId ? `/prefacturas/${prefacturaId}` : undefined,
      };
    }
    case "vehiculo":
      return {
        titulo: (fila?.placa as string | undefined) ?? id ?? "—",
        href: id ? `/vehiculos/${id}` : undefined,
      };
    case "transportista":
      return {
        titulo:
          (fila?.razon_social as string | undefined) ?? (fila?.nombre as string | undefined) ?? id ?? "—",
        href: id ? `/transportistas/${id}` : undefined,
      };
    case "perfil_usuario":
      return { titulo: (fila?.nombre as string | undefined) ?? id ?? "—", href: "/usuarios" };
    case "configuracion":
      return { titulo: (fila?.clave as string | undefined) ?? id ?? "—", href: "/configuracion" };
    case "conductor": {
      const nombre = [fila?.nombres, fila?.apellidos].filter(Boolean).join(" ").trim();
      return { titulo: nombre || (id ?? "—") };
    }
    case "vehiculo_conductor": {
      const vehiculoId = fila?.vehiculo_id as string | undefined;
      return { titulo: "Asignación", href: vehiculoId ? `/vehiculos/${vehiculoId}` : undefined };
    }
    case "contacto_correo": {
      const vehiculoId = fila?.vehiculo_id as string | undefined;
      const transportistaId = fila?.transportista_id as string | undefined;
      return {
        titulo: (fila?.email as string | undefined) ?? id ?? "—",
        href: vehiculoId
          ? `/vehiculos/${vehiculoId}`
          : transportistaId
            ? `/transportistas/${transportistaId}`
            : undefined,
      };
    }
    case "periodo":
      return { titulo: (fila?.nombre as string | undefined) ?? id ?? "—" };
    case "regional":
      return { titulo: (fila?.nombre as string | undefined) ?? id ?? "—" };
    case "tipo_ruta_centro_costo":
      return { titulo: (fila?.tipo_ruta as string | undefined) ?? id ?? "—", href: "/configuracion" };
    case "descuento": {
      const prefacturaId = fila?.prefactura_id as string | undefined;
      return {
        titulo: (fila?.concepto as string | undefined) ?? (fila?.item as string | undefined) ?? id ?? "—",
        href: prefacturaId ? `/prefacturas/${prefacturaId}` : undefined,
      };
    }
    default:
      return { titulo: id ?? "—" };
  }
}

/** Campos técnicos que no aportan al diff (siempre cambian o son ruido de auditoría). */
const CAMPOS_IGNORADOS_DIFF = new Set(["updated_at", "created_at"]);

export interface CampoCambiado {
  campo: string;
  anterior: unknown;
  nuevo: unknown;
}

/** Para UPDATE: solo los campos cuyo valor cambió. Para INSERT/DELETE: todos los campos relevantes de esa fila. */
export function camposCambiados(
  entrada: Pick<EntradaAuditoria, "accion" | "antes" | "despues">,
): CampoCambiado[] {
  const antes = (entrada.antes as FilaJson | null) ?? {};
  const despues = (entrada.despues as FilaJson | null) ?? {};

  if (entrada.accion === "INSERT") {
    return Object.entries(despues)
      .filter(([campo]) => !CAMPOS_IGNORADOS_DIFF.has(campo))
      .map(([campo, nuevo]) => ({ campo, anterior: undefined, nuevo }));
  }
  if (entrada.accion === "DELETE") {
    return Object.entries(antes)
      .filter(([campo]) => !CAMPOS_IGNORADOS_DIFF.has(campo))
      .map(([campo, anterior]) => ({ campo, anterior, nuevo: undefined }));
  }

  const campos = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  const cambios: CampoCambiado[] = [];
  for (const campo of campos) {
    if (CAMPOS_IGNORADOS_DIFF.has(campo)) continue;
    const anterior = antes[campo];
    const nuevo = despues[campo];
    if (JSON.stringify(anterior) !== JSON.stringify(nuevo)) {
      cambios.push({ campo, anterior, nuevo });
    }
  }
  return cambios;
}
