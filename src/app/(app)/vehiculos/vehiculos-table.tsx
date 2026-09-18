"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VehiculoConRelaciones } from "@/lib/vehiculos/queries";

const columnas: ColumnDef<VehiculoConRelaciones>[] = [
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
    cell: ({ row }) => row.original.transportista?.razon_social ?? "—",
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
];

export function VehiculosTable({
  filas,
  total,
  pagina,
  tamanoPagina,
}: {
  filas: VehiculoConRelaciones[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busqueda, setBusqueda] = useState(searchParams.get("q") ?? "");

  const table = useReactTable({
    data: filas,
    columns: columnas,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / tamanoPagina)),
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
                  No se encontraron vehículos.
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
