"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarVehiculo, crearVehiculoYRedirigir } from "@/lib/vehiculos/actions";
import type { Vehiculo } from "@/lib/vehiculos/queries";
import { vehiculoFormSchema, type VehiculoFormValues } from "@/lib/vehiculos/schema";

interface OpcionSelect {
  id: string;
  nombre: string;
}

export function VehiculoForm({
  vehiculo,
  transportistas,
  regionales,
}: {
  vehiculo?: Vehiculo;
  transportistas: { id: string; razon_social: string }[];
  regionales: OpcionSelect[];
}) {
  const router = useRouter();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VehiculoFormValues>({
    resolver: zodResolver(vehiculoFormSchema),
    defaultValues: {
      placa: vehiculo?.placa ?? "",
      transportistaId: vehiculo?.transportista_id ?? "",
      propietario: vehiculo?.propietario ?? "",
      marca: vehiculo?.marca ?? "",
      modelo: vehiculo?.modelo ?? "",
      anio: vehiculo?.anio ?? undefined,
      tonelaje: vehiculo?.tonelaje ?? undefined,
      tipoVehiculo: vehiculo?.tipo_vehiculo ?? "",
      largo: vehiculo?.largo ?? undefined,
      alto: vehiculo?.alto ?? undefined,
      ancho: vehiculo?.ancho ?? undefined,
      cubicaje: vehiculo?.cubicaje ?? undefined,
      regionalId: vehiculo?.regional_id ?? "",
      activo: vehiculo?.activo ?? true,
    },
  });

  const onSubmit = handleSubmit(async (valores) => {
    setErrorServidor(null);
    const resultado = vehiculo
      ? await actualizarVehiculo(vehiculo.id, valores)
      : await crearVehiculoYRedirigir(valores);

    if (!resultado.ok) {
      setErrorServidor(resultado.error ?? "Ocurrió un error.");
      return;
    }
    if (vehiculo) {
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="placa">Placa</Label>
          <Input id="placa" {...register("placa")} disabled={!!vehiculo} placeholder="ABC1234" />
          {errors.placa ? <p className="text-sm text-destructive">{errors.placa.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="transportistaId">Transportista</Label>
          <select
            id="transportistaId"
            {...register("transportistaId")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Sin asignar</option>
            {transportistas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.razon_social}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="propietario">Propietario</Label>
          <Input id="propietario" {...register("propietario")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="regionalId">Regional</Label>
          <select
            id="regionalId"
            {...register("regionalId")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Sin asignar</option>
            {regionales.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="marca">Marca</Label>
          <Input id="marca" {...register("marca")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="modelo">Modelo</Label>
          <Input id="modelo" {...register("modelo")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="anio">Año</Label>
          <Input id="anio" type="number" {...register("anio")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipoVehiculo">Tipo de vehículo</Label>
          <Input id="tipoVehiculo" {...register("tipoVehiculo")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tonelaje">Tonelaje</Label>
          <Input id="tonelaje" type="number" step="0.01" {...register("tonelaje")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cubicaje">Cubicaje</Label>
          <Input id="cubicaje" type="number" step="0.0001" {...register("cubicaje")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="largo">Largo</Label>
          <Input id="largo" type="number" step="0.01" {...register("largo")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alto">Alto</Label>
          <Input id="alto" type="number" step="0.01" {...register("alto")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ancho">Ancho</Label>
          <Input id="ancho" type="number" step="0.01" {...register("ancho")} />
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
        {isSubmitting ? "Guardando..." : vehiculo ? "Guardar cambios" : "Crear vehículo"}
      </Button>
    </form>
  );
}
