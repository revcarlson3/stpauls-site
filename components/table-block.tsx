"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { TableConfig, TableRow } from "@/lib/blocks";

export function TableBlock({ config, className = "" }: { config: TableConfig; className?: string }) {
  const data = config.rows;
  const columns = useMemo<ColumnDef<TableRow>[]>(() => config.columns.map((column, index) => ({
    id: column.id,
    accessorFn: (row) => row.cells[index] ?? "",
    header: column.header,
    cell: (context) => context.getValue<string>(),
  })), [config.columns]);
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const cellPadding = config.spacing === "compact" ? "px-3 py-2" : "px-4 py-3";
  const alignment = config.alignment === "center" ? "text-center" : config.alignment === "right" ? "text-right" : "text-left";

  return (
    <div className={`${config.responsive ? "overflow-x-auto" : "overflow-x-visible"} ${className}`}>
      <table className={`w-full min-w-[32rem] border-collapse text-sm text-ink ${alignment}`} aria-label={config.caption || undefined}>
        {config.caption && <caption className="mb-3 text-left font-serif text-xl font-semibold text-ink">{config.caption}</caption>}
        {config.headerRow && <thead className="border-b-2 border-[rgb(var(--color-ink)/.2)] bg-mist/70">
          {table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => <th key={header.id} scope="col" className={`${cellPadding} text-left font-semibold ${alignment}`} style={{ textAlign: config.columns.find((column) => column.id === header.column.id)?.align ?? config.alignment }}>
              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
            </th>)}
          </tr>)}
        </thead>}
        <tbody>
          {table.getRowModel().rows.map((row) => <tr key={row.id} className={`border-b border-ink/10 last:border-b-0 ${config.striped && row.index % 2 === 1 ? "bg-mist/40" : ""}`}>
            {row.getVisibleCells().map((cell, index) => <td key={cell.id} className={`${cellPadding} align-top`} style={{ textAlign: config.columns[index]?.align ?? config.alignment }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}
