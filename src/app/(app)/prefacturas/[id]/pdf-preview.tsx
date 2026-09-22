"use client";

import { useEffect, useState } from "react";

/**
 * Vista previa embebida del PDF vigente, para revisarlo antes de mandarlo
 * por correo sin tener que descargarlo aparte. `key={version}` en el
 * llamador fuerza que este componente se vuelva a montar (y por lo tanto
 * a pedir una URL firmada nueva) cada vez que se regenera el PDF.
 */
export function PdfPreview({ prefacturaId }: { prefacturaId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    fetch(`/api/prefacturas/${prefacturaId}/pdf`)
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json().catch(() => null);
        if (cancelado) return;
        if (!respuesta.ok) {
          setError(cuerpo?.error ?? "No se pudo cargar la vista previa del PDF.");
          return;
        }
        setUrl(cuerpo.url);
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
      <div className="flex h-[600px] items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        Cargando vista previa...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
        {error ?? "No se pudo cargar la vista previa del PDF."}
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title="Vista previa del PDF de la prefactura"
      className="h-[600px] w-full rounded-lg border bg-card"
    />
  );
}
