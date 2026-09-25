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
import {
  eliminarTransportistaAction,
  eliminarTransportistasAction,
  restaurarTransportistaAction,
  restaurarTransportistasAction,
} from "@/lib/transportistas/actions";
import type { Transportista } from "@/lib/transportistas/queries";

function crearColumnas(
  puedeGestionar: boolean,
  mostrandoEliminados: boolean,
  onCambio: () => void,
): ColumnDef<Transportista>[] {
  const columnas: ColumnDef<Transportista>[] = [];

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
      accessorKey: "ruc",
      header: "RUC",
    },
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => (
        <Link
          href={`/transportistas/${row.original.id}`}
          className="font-medium text-primary-ink hover:underline"
        >
          {row.original.nombre || "(sin nombre)"}
        </Link>
      ),
    },
    {
      accessorKey: "razon_social",
      header: "Razón social",
      cell: ({ row }) => row.original.razon_social,
    },
    {
      accessorKey: "tipo_transportista",
      header: "Tipo",
      cell: ({ row }) => row.original.tipo_transportista ?? "—",
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
        const nombre = row.original.nombre || row.original.razon_social;
        return mostrandoEliminados ? (
          <BotonAccionConfirmada
            accion={() => restaurarTransportistaAction(row.original.id)}
            etiqueta="Restaurar"
            etiquetaCargando="Restaurando..."
            confirmacion1={`¿Restaurar "${nombre}"?`}
            confirmacion2={`Confirma de nuevo: ¿restaurar "${nombre}" y que vuelva a aparecer en listas y selectores?`}
            onExito={onCambio}
          />
        ) : (
          <BotonAccionConfirmada
            accion={() => eliminarTransportistaAction(row.original.id)}
            etiqueta="Eliminar"
            etiquetaCargando="Eliminando..."
            variant="ghost"
            className="text-destructive hover:text-destructive"
            confirmacion1={`¿Eliminar "${nombre}"? Dejará de aparecer en listas y selectores.`}
            confirmacion2={`Última confirmación: ¿de verdad quieres eliminar "${nombre}"?`}
            onExito={onCambio}
          />
        );
      },
    });
  }

  return columnas;
}

export function TransportistasTable({
  filas,
  total,
  pagina,
  tamanoPagina,
  puedeGestionar,
  mostrandoEliminados,
}: {
  filas: Transportista[];
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
    router.push(`/transportistas?${params.toString()}`);
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
    router.push(`/transportistas?${params.toString()}`);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));
  const idsSeleccionados = Object.keys(seleccion);

  return (
    <div className="space-y-4">
      <form onSubmit={buscar} className="flex gap-2">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por RUC o razón social..."
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
              accion={() => restaurarTransportistasAction(idsSeleccionados)}
              etiqueta="Restaurar seleccionados"
              etiquetaCargando="Restaurando..."
              confirmacion1={`¿Restaurar ${idsSeleccionados.length} transportistas?`}
              confirmacion2="Confirma de nuevo: van a volver a aparecer en listas y selectores."
              onExito={limpiarYRefrescar}
            />
          ) : (
            <BotonAccionConfirmada
              accion={() => eliminarTransportistasAction(idsSeleccionados)}
              etiqueta="Eliminar seleccionados"
              etiquetaCargando="Eliminando..."
              variant="destructive"
              confirmacion1={`¿Eliminar ${idsSeleccionados.length} transportistas? Dejarán de aparecer en listas y selectores.`}
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
                  {mostrandoEliminados
                    ? "No hay transportistas eliminados."
                    : "No se encontraron transportistas."}
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
          Página {pagina} de {totalPaginas} · {total} transportistas
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
