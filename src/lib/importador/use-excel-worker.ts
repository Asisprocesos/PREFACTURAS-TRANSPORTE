"use client";

import { useCallback, useEffect, useRef } from "react";

import type { MensajeEntrada, MensajeSalida } from "@/workers/excel-parser.worker";

/**
 * Hook cliente para hablar con excel-parser.worker.ts. Un solo request en
 * vuelo a la vez (encaja con el flujo secuencial del asistente de
 * importación: analizar -> elegir hoja -> previsualizar).
 */
export function useExcelWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL("../../workers/excel-parser.worker.ts", import.meta.url), {
      type: "module",
    });
    return () => workerRef.current?.terminate();
  }, []);

  const enviar = useCallback(<T extends MensajeSalida>(mensaje: MensajeEntrada, tipoEsperado: T["tipo"]) => {
    return new Promise<T>((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error("El worker de Excel no está disponible."));
        return;
      }

      const onMessage = (event: MessageEvent<MensajeSalida>) => {
        const data = event.data;
        if (data.tipo === "error") {
          worker.removeEventListener("message", onMessage);
          reject(new Error(data.mensaje));
          return;
        }
        if (data.tipo === tipoEsperado) {
          worker.removeEventListener("message", onMessage);
          resolve(data as T);
        }
      };

      worker.addEventListener("message", onMessage);
      worker.postMessage(mensaje);
    });
  }, []);

  const analizar = useCallback(
    (archivo: File) => enviar<Extract<MensajeSalida, { tipo: "hojas" }>>({ tipo: "analizar", archivo }, "hojas"),
    [enviar],
  );

  const previsualizar = useCallback(
    (hoja: string) =>
      enviar<Extract<MensajeSalida, { tipo: "previsualizacion" }>>({ tipo: "previsualizar", hoja }, "previsualizacion"),
    [enviar],
  );

  return { analizar, previsualizar };
}
