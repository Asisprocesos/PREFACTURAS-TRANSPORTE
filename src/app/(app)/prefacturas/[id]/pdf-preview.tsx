"use client";

import { useEffect, useState } from "react";

/**
 * Vista previa embebida del PDF vigente, para revisarlo antes de mandarlo
 * por correo sin tener que descargarlo aparte. `key={version}` en el
 * llamador fuerza que este componente se vuelva a montar (y por lo tanto
 * a pedir una URL firmada nueva) cada vez que se regenera el PDF.
 */
export function PdfPreview({
  prefacturaId,
  alto = "h-[600px]",
}: {
  prefacturaId: string;
  /** Clase Tailwind de alto; permite una versión compacta embebida en el formulario de envío. */
  alto?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    fetch(`/api/prefacturas/${prefacturaId}/pdf?inline=1`)
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json().catch(() => null);
        if (cancelado) return;
        if (!respuesta.ok) {
          setError(cuerpo?.error ?? "No se pudo cargar la vista previa del PDF.");
          return;
        }
        setUrl(cuerpo.url);
        setNombreArchivo(cuerpo.nombreArchivo ?? null);
      })
      .catch(() => {
        if (!cancelado) setError("No se pudo cargar la vista previa del PDF.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [prefacturaId]);

  if (cargando) {
    return (
      <div
        className={`flex ${alto} items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground`}
      >
        Cargando vista previa...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div
        className={`flex ${alto} items-center justify-center rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground`}
      >
        {error ?? "No se pudo cargar la vista previa del PDF."}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {nombreArchivo ? (
        <p className="text-xs text-muted-foreground">
          Archivo que se adjuntará: <span className="font-medium text-foreground">{nombreArchivo}</span>
        </p>
      ) : null}
      <iframe
        src={url}
        title="Vista previa del PDF de la prefactura"
        className={`${alto} w-full rounded-lg border bg-card`}
      />
    </div>
  );
}
