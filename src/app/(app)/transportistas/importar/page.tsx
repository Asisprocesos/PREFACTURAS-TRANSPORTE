import { BotonVolver } from "@/components/ui/boton-volver";
import { requireRole } from "@/lib/auth/roles";

import { FormularioImportarMaestros } from "./formulario-importar-maestros";

// El Server Action de carga masiva (importarMaestrosAction) hereda este
// límite de duración de la página que lo invoca. Sin esto, cae en el
// límite por defecto de Vercel (unos pocos segundos) y un archivo con
// varias filas —cada una hace varias consultas seguidas a la base de
// datos— se corta a mitad de camino sin avisar: el navegador se queda
// esperando una respuesta que nunca llega ("Procesando..." sin avanzar).
export const maxDuration = 60;

export default async function ImportarMaestrosPage() {
  await requireRole(["ADMIN", "OPERADOR_TRANSPORTE"]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BotonVolver fallbackHref="/transportistas" />
      <div>
        <h1 className="titulo-marca text-2xl">Carga masiva de Vehículos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Una sola hoja, una fila por vehículo: incluye los datos del transportista dueño, el vehículo y su
          conductor. La Placa identifica a cada vehículo y el RUC a cada transportista: si ya existen se
          actualizan sus datos, si no, se crean. Los correos de contacto solo se agregan, nunca se borran.
        </p>
      </div>
      <FormularioImportarMaestros />
    </div>
  );
}
