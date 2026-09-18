"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarTransportista, crearTransportistaYRedirigir } from "@/lib/transportistas/actions";
import { transportistaFormSchema, type TransportistaFormValues } from "@/lib/transportistas/schema";
import type { Transportista } from "@/lib/transportistas/queries";

export function TransportistaForm({ transportista }: { transportista?: Transportista }) {
  const router = useRouter();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TransportistaFormValues>({
    resolver: zodResolver(transportistaFormSchema),
    defaultValues: {
      ruc: transportista?.ruc ?? "",
      razonSocial: transportista?.razon_social ?? "",
      tipoTransportista: transportista?.tipo_transportista ?? "",
      activo: transportista?.activo ?? true,
    },
  });

  const onSubmit = handleSubmit(async (valores) => {
    setErrorServidor(null);
    const resultado = transportista
      ? await actualizarTransportista(transportista.id, valores)
      : await crearTransportistaYRedirigir(valores);

    if (!resultado.ok) {
      setErrorServidor(resultado.error ?? "Ocurrió un error.");
      return;
    }
    if (transportista) {
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ruc">RUC</Label>
          <Input id="ruc" {...register("ruc")} disabled={!!transportista} />
          {errors.ruc ? <p className="text-sm text-destructive">{errors.ruc.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="razonSocial">Razón social</Label>
          <Input id="razonSocial" {...register("razonSocial")} />
          {errors.razonSocial ? <p className="text-sm text-destructive">{errors.razonSocial.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipoTransportista">Tipo de transportista</Label>
          <Input id="tipoTransportista" {...register("tipoTransportista")} placeholder="Opcional" />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <input id="activo" type="checkbox" className="h-4 w-4" {...register("activo")} />
          <Label htmlFor="activo" className="mb-0">
            Activo
          </Label>
        </div>
      </div>
      {errorServidor ? <p className="text-sm text-destructive">{errorServidor}</p> : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : transportista ? "Guardar cambios" : "Crear transportista"}
      </Button>
    </form>
  );
}
