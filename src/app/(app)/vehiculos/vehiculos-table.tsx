"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { BotonAccionConfirmada } from "@/components/ui/boton-accion-confirmada";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nombreTransportista } from "@/lib/transportistas/display";
import {
  eliminarVehiculoAction,
  eliminarVehiculosAction,
  restaurarVehiculoAction,
  restaurarVehiculosAction,
} from "@/lib/vehiculos/actions";
import type { VehiculoConRelaciones } from "@/lib/vehiculos/queries";

function crearColumnas(
  puedeGestionar: boolean,
  mostrandoEliminados: boolean,
  onCambio: () => void,
): ColumnDef<VehiculoConRelaciones>[] {
  const columnas: ColumnDef<VehiculoConRelaciones>[] = [];

  if (puedeGestionar) {
    columnas.push({
      id: "seleccion",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input type="checkbox" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
      ),
    });
  }

  columnas.push(
    {
      accessorKey: "placa",
      header: "Placa",
      cell: ({ row }) => (
        <Link href={`/vehiculos/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.placa}
        </Link>
      ),
    },
    {
      id: "transportista",
      header: "Transportista",
      cell: ({ row }) => nombreTransportista(row.original.transportista) ?? "—",
    },
    {
      id: "regional",
      header: "Regional",
      cell: ({ row }) => row.original.regional?.nombre ?? "—",
    },
    {
      accessorKey: "tipo_vehiculo",
      header: "Tipo",
      cell: ({ row }) => row.original.tipo_vehiculo ?? "—",
    },
    {
      accessorKey: "activo",
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={
            row.original.activo
              ? "rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary-foreground/80"
              : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          {row.original.activo ? "Activo" : "Inactivo"}
        </span>
      ),
    },
  );

  if (puedeGestionar) {
    columnas.push({
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const placa = row.original.placa;
        return mostrandoEliminados ? (
          <BotonAccionConfirmada
            accion={() => restaurarVehiculoAction(row.original.id)}
            etiqueta="Restaurar"
            etiquetaCargando="Restaurando..."
            confirmacion1={`¿Restaurar el vehículo ${placa}?`}
            confirmacion2={`Confirma de nuevo: ¿restaurar ${placa} y que vuelva a aparecer en listas y selectores?`}
            onExito={onCambio}
          />
        ) : (
          <BotonAccionConfirmada
            accion={() => eliminarVehiculoAction(row.original.id)}
            etiqueta="Eliminar"
            etiquetaCargando="Eliminando..."
            variant="ghost"
            className="text-destructive hover:text-destructive"
            confirmacion1={`¿Eliminar el vehículo ${placa}? Dejará de aparecer en listas y selectores.`}
            confirmacion2={`Última confirmación: ¿de verdad quieres eliminar ${placa}?`}
            onExito={onCambio}
          />
        );
      },
    });
  }

  return columnas;
}

export function VehiculosTable({
  filas,
  total,
  pagina,
  tamanoPagina,
  puedeGestionar,
  mostrandoEliminados,
}: {
  filas: VehiculoConRelaciones[];
  total: number;
  pagina: number;
  tamanoPagina: number;
  puedeGestionar: boolean;
  mostrandoEliminados: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busqueda, setBusqueda] = useState(searchParams.get("q") ?? "");
  const [seleccion, setSeleccion] = useState<RowSelectionState>({});

  function limpiarYRefrescar() {
    setSeleccion({});
    router.refresh();
  }

  const columnas = crearColumnas(puedeGestionar, mostrandoEliminados, limpiarYRefrescar);
  const table = useReactTable({
    data: filas,
    columns: columnas,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / tamanoPagina)),
    state: { rowSelection: seleccion },
    onRowSelectionChange: setSeleccion,
    getRowId: (row) => row.id,
  });

  function irAPagina(nuevaPagina: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nuevaPagina));
    router.push(`/vehiculos?${params.toString()}`);
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (busqueda.trim()) {
      params.set("q", busqueda.trim());
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    router.push(`/vehiculos?${params.toString()}`);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));
  const idsSeleccionados = Object.keys(seleccion);

  return (
    <div className="space-y-4">
      <form onSubmit={buscar} className="flex gap-2">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por placa..."
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {puedeGestionar && idsSeleccionados.length > 0 ? (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2 text-sm">
          <span>{idsSeleccionados.length} seleccionados</span>
          {mostrandoEliminados ? (
            <BotonAccionConfirmada
              accion={() => restaurarVehiculosAction(idsSeleccionados)}
              etiqueta="Restaurar seleccionados"
              etiquetaCargando="Restaurando..."
              confirmacion1={`¿Restaurar ${idsSeleccionados.length} vehículos?`}
              confirmacion2="Confirma de nuevo: van a volver a aparecer en listas y selectores."
              onExito={limpiarYRefrescar}
            />
          ) : (
            <BotonAccionConfirmada
              accion={() => eliminarVehiculosAction(idsSeleccionados)}
              etiqueta="Eliminar seleccionados"
              etiquetaCargando="Eliminando..."
              variant="destructive"
              confirmacion1={`¿Eliminar ${idsSeleccionados.length} vehículos? Dejarán de aparecer en listas y selectores.`}
              confirmacion2="Última confirmación: ¿de verdad quieres eliminarlos?"
              onExito={limpiarYRefrescar}
            />
          )}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-medium">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} className="px-4 py-6 text-center text-muted-foreground">
                  {mostrandoEliminados ? "No hay vehículos eliminados." : "No se encontraron vehículos."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {pagina} de {totalPaginas} · {total} vehículos
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => irAPagina(pagina - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => irAPagina(pagina + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
