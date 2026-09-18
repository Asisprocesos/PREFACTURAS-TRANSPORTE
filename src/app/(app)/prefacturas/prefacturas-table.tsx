"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { PrefacturaConRelaciones } from "@/lib/prefacturas/queries";
import { cn } from "@/lib/utils";

const ETIQUETA_ESTADO: Record<string, string> = {
  BORRADOR: "Borrador",
  CON_NOVEDADES: "Con novedades",
  LISTA: "Lista",
  PDF_GENERADO: "PDF generado",
  EN_COLA_ENVIO: "En cola de envío",
  ENVIADA: "Enviada",
  ERROR_ENVIO: "Error de envío",
  REQUIERE_REGENERAR: "Requiere regenerar",
  ANULADA: "Anulada",
};

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const columnas: ColumnDef<PrefacturaConRelaciones>[] = [
  {
    accessorKey: "numero",
    header: "Número",
    cell: ({ row }) => (
      <Link href={`/prefacturas/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.original.numero ?? "(sin número)"}
      </Link>
    ),
  },
  { id: "placa", header: "Placa", cell: ({ row }) => row.original.vehiculo?.placa ?? "—" },
  {
    id: "transportista",
    header: "Transportista",
    cell: ({ row }) => row.original.transportista?.razon_social ?? "—",
  },
  { id: "periodo", header: "Período", cell: ({ row }) => row.original.periodo?.nombre ?? "—" },
  {
    accessorKey: "cantidad_odt",
    header: "ODT",
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => formatoMoneda.format(row.original.total),
  },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: ({ row }) => (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {ETIQUETA_ESTADO[row.original.estado] ?? row.original.estado}
      </span>
    ),
  },
];

export function PrefacturasTable({
  filas,
  total,
  pagina,
  tamanoPagina,
}: {
  filas: PrefacturaConRelaciones[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    router.push(`/prefacturas?${params.toString()}`);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));

  return (
    <div className="space-y-4">
      <div className={cn("overflow-x-auto rounded-lg border bg-card")}>
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
                  No hay prefacturas con estos filtros.
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
          Página {pagina} de {totalPaginas} · {total} prefacturas
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
