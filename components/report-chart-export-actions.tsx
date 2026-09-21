"use client";

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { Button } from "@/components/ui";
import { reportChartSvg } from "@/lib/report-chart-export";

pdfMake.vfs = pdfFonts.vfs;
const pdf = pdfMake as typeof pdfMake & { createPdf: (definition: object) => { download: (filename: string) => void } };

export function ReportChartExportActions({ title, reportName, items, chartType = "bar", valueFormat = "number", generatedLabel }: { title: string; reportName: string; items: { label: string; count: number }[]; chartType?: "bar" | "line" | "pie"; valueFormat?: "number" | "currency"; generatedLabel?: string }) {
  function chartSvg() {
    return reportChartSvg(title, items, chartType, { width: 1000, height: 520 }, valueFormat);
  }
  function exportPdf() {
    pdf.createPdf({
      pageSize: "LETTER",
      pageMargins: [36, 36, 36, 36],
      content: [
        { text: reportName, alignment: "center", bold: true, fontSize: 16 },
        ...(generatedLabel ? [{ text: generatedLabel, alignment: "center", fontSize: 9, margin: [0, 6, 0, 14] }] : []),
        { svg: chartSvg(), width: 540 },
        { text: "Chart values", bold: true, fontSize: 10, margin: [0, 12, 0, 4] },
        { table: { widths: ["*", 90], body: items.map((item) => [{ text: item.label, fontSize: 9 }, { text: valueFormat === "currency" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.count) : item.count.toLocaleString(), alignment: "right", fontSize: 9 }]) }, layout: "lightHorizontalLines" },
      ],
    }).download(`${reportName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
  }
  function print() {
    const windowRef = window.open("", "_blank", "noopener,noreferrer");
    if (!windowRef) return;
    windowRef.document.write(`<html><head><title>${reportName}</title><style>@page{margin:.5in}body{font-family:Arial,sans-serif;color:#202a2e}svg{display:block;width:100%;height:auto}</style></head><body><h1>${reportName}</h1>${generatedLabel ? `<p>${generatedLabel}</p>` : ""}${chartSvg()}</body></html>`);
    windowRef.document.close();
    windowRef.focus();
    windowRef.print();
  }
  return <div className="flex flex-wrap gap-2">
    <Button type="button" onClick={exportPdf}>Export PDF</Button>
    <Button type="button" variant="secondary" onClick={print}>Print chart</Button>
  </div>;
}
