"use client";

import { useRef } from "react";
import DataTable from "datatables.net-react";
import type { DataTableRef } from "datatables.net-react";
import type { Api as DTApi } from "datatables.net";
import DT from "datatables.net-dt";
import "datatables.net-buttons-dt";
import "datatables.net-buttons/js/buttons.html5.mjs";
import "datatables.net-buttons/js/buttons.print.mjs";
import "datatables.net-buttons/js/buttons.colVis.mjs";
import "datatables.net-colreorder-dt";
import "datatables.net-colreorder";
import JSZip from "jszip";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { MembershipReportLayout } from "@/lib/membership-reporting";

DataTable.use(DT);
DT.Buttons.jszip(JSZip);
DT.Buttons.pdfMake(pdfMake);
pdfMake.vfs = pdfFonts.vfs;

type Result = { id: string; [key: string]: string | number };
type Column = { key: string; label: string };

function getInitialOrder(columns: Column[], layout: MembershipReportLayout) {
  const saved = (layout.order ?? []).map((key) => columns.findIndex((column) => column.key === key)).filter((index) => index >= 0);
  return [...saved, ...columns.map((_, index) => index).filter((index) => !saved.includes(index))];
}

function addResizeHandles(api: DTApi<any>, columns: Column[], onLayoutChange: (layout: MembershipReportLayout) => void) {
  const table = api.table().node() as HTMLTableElement;
  const headers = Array.from(table.querySelectorAll("thead th"));
  headers.forEach((header) => {
    if (header.querySelector(".dt-resize-handle")) return;
    header.classList.add("dt-resizable-header");
    const handle = document.createElement("span");
    handle.className = "dt-resize-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = header.getBoundingClientRect().width;
      const move = (moveEvent: PointerEvent) => {
        (header as HTMLTableCellElement).style.width = `${Math.max(80, startWidth + moveEvent.clientX - startX)}px`;
        api.columns.adjust();
      };
      const stop = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", stop);
        const widths: Record<string, number> = {};
        const order = api.colReorder.order() as number[];
        headers.forEach((item, index) => {
          const column = columns[order[index] ?? index];
          if (column) widths[column.key] = Math.round(item.getBoundingClientRect().width);
        });
        onLayoutChange({ widths });
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop, { once: true });
    });
    header.appendChild(handle);
  });
}

export function ReportDataTable({ rows, columns, sort, direction, layout, reportName, generatedAt, generatedBy, serverUrl, onLayoutChange }: { rows: Result[]; columns: Column[]; sort: string; direction: "asc" | "desc"; layout: MembershipReportLayout; reportName: string; generatedAt: string; generatedBy: string; serverUrl?: string; onLayoutChange: (layout: MembershipReportLayout) => void }) {
  const tableRef = useRef<DataTableRef>(null);
  const initialOrder = getInitialOrder(columns, layout);
  const saveCurrentLayout = () => {
    const api = tableRef.current?.dt();
    if (!api) return;
    const order = api.colReorder.order() as number[];
    const orderKeys = order.map((index) => columns[index]?.key).filter((key): key is string => Boolean(key));
    const visibility = Object.fromEntries(columns.map((column, index) => [column.key, api.column(index).visible()]));
    onLayoutChange({ order: orderKeys, visibility });
  };

  const generatedLabel = `Generated ${new Date(generatedAt).toLocaleString()}${generatedBy ? ` by ${generatedBy}` : ""}`;
  return <DataTable
    ref={tableRef}
    data={serverUrl ? undefined : rows}
    columns={columns.map((column) => ({ data: column.key, name: column.key, title: column.label, visible: layout.visibility?.[column.key] !== false, width: layout.widths?.[column.key] ? `${layout.widths[column.key]}px` : undefined }))}
    className="display compact w-full"
    onColumnReorder={saveCurrentLayout}
    onColumnVisibility={saveCurrentLayout}
    options={{
      processing: Boolean(serverUrl),
      serverSide: Boolean(serverUrl),
      ajax: serverUrl ? async (request: object, callback: (response: unknown) => void) => {
        const requestData = request as Record<string, unknown>;
        const params = new URLSearchParams();
        Object.entries(requestData).forEach(([key, value]) => {
          if (typeof value === "string" || typeof value === "number") params.set(key, String(value));
        });
        const nested = requestData as { search?: { value?: string }; order?: { column?: number; dir?: string }[]; columns?: { name?: string }[] };
        if (nested.search?.value) params.set("search[value]", nested.search.value);
        if (nested.order?.[0]) {
          params.set("order[0][column]", String(nested.order[0].column ?? 0));
          params.set("order[0][dir]", nested.order[0].dir ?? "asc");
        }
        (nested.columns ?? []).forEach((column, index) => params.set(`columns[${index}][name]`, column.name ?? ""));
        const response = await fetch(`${serverUrl}&${params.toString()}`, { cache: "no-store" });
        const value = await response.json();
        callback({ draw: value.draw, recordsTotal: value.recordsTotal, recordsFiltered: value.recordsFiltered, data: value.data ?? [] });
      } : undefined,
      paging: true,
      pageLength: 25,
      lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
      colReorder: { order: initialOrder },
      order: [[Math.max(0, columns.findIndex((column) => column.key === sort)), direction]],
      initComplete: function (settings) {
        addResizeHandles(new DT.Api(settings), columns, onLayoutChange);
      },
      layout: {
        topStart: { buttons: [
          "copy",
          "csv",
          "excel",
          { extend: "pdfHtml5", customize: (document: { content: Array<{ text?: string; style?: string }> }) => { document.content.unshift({ text: generatedLabel, style: "small" }); document.content.unshift({ text: reportName, style: "header" }); } },
          { extend: "print", title: reportName, messageTop: `<div class="report-print-meta">${generatedLabel}</div>` },
          "colvis"
        ] },
        topEnd: "search",
        bottomStart: "pageLength",
        bottomEnd: "paging"
      },
      language: { emptyTable: "No members match this report." }
    }}
  />;
}
