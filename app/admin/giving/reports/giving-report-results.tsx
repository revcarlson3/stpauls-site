"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Notification } from "@/components/ui";
import { ReportSummaryChart } from "@/components/report-summary-chart";
import { ReportChartExportActions } from "@/components/report-chart-export-actions";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { givingReportTypeLabel } from "@/lib/giving-reporting";
import dynamic from "next/dynamic";
import type { MembershipReportLayout } from "@/lib/membership-reporting";
import { reportChartSvg } from "@/lib/report-chart-export";

const ReportDataTable = dynamic(() => import("@/app/admin/membership/reports/report-data-table").then((module) => module.ReportDataTable), { ssr: false });

type ResultReport = {
  id: string;
  name: string;
  reportType: string;
  columns: { key: string; label: string }[];
  criteria?: { dateFrom?: string; dateTo?: string; chart?: boolean; chartOnly?: boolean; chartType?: "bar" | "line" | "pie" };
  layout?: MembershipReportLayout;
  generatedAt?: string;
  generatedBy?: string;
  grouping?: { key?: string; direction?: "asc" | "desc"; aggregation?: "count" | "sumAmount" };
};
type ResultRow = { id: string; [key: string]: string | number };
type GivingSummaryRow = ResultRow & {
  categoryCode: string;
  categoryName: string;
  parentName: string;
  section: "general" | "nonBudget";
  amount: number;
};
type Statement = {
  id: string;
  church: { name: string; addressStreet: string; addressCity: string; addressState: string; addressZip: string; phone: string; email: string; taxId: string };
  household: { name: string; addressStreet: string; addressCity: string; addressState: string; addressZip: string };
  envelopeNumber: string;
  rows: { id: string; date: string; category: string; amount: number; deductible: boolean }[];
  totals: { deductible: number; nondeductible: number; total: number };
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
pdfMake.vfs = pdfFonts.vfs;
const pdf = pdfMake as typeof pdfMake & { createPdf: (definition: object) => { download: (filename: string) => void } };

export function GivingReportResults() {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<ResultReport | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [summary, setSummary] = useState<{ total: number; amount: number } | null>(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [layout, setLayout] = useState<MembershipReportLayout>({});
  const [layoutMessage, setLayoutMessage] = useState("");
  const [groupingCounts, setGroupingCounts] = useState<{ label: string; count: number }[]>([]);
  const requestId = useRef(0);

  const loadResults = useCallback(async (url: string) => {
    const currentRequest = ++requestId.current;
    setOpen(true);
    setError("");
    setUnavailable(false);
    setReport(null);
    setRows([]);
    setSummary(null);
    setStatements([]);
    setLayout({});
    setLayoutMessage("");
    setGroupingCounts([]);
    const response = await fetch(url, { cache: "no-store" });
    const value = await response.json();
    if (currentRequest !== requestId.current) return;
    if (!response.ok) {
      setError(value.error ?? "Unable to run giving report.");
      return;
    }
    setReport(value.report);
    setRows(value.rows ?? []);
    setSummary(value.summary ?? null);
    setUnavailable(Boolean(value.unavailable));
    setStatements(value.statements ?? []);
    setGroupingCounts(value.groupingCounts ?? []);
    setLayout(value.report?.layout ?? {});
    setLayoutMessage("");
  }, []);
  const run = useCallback(async (id: string) => {
    await loadResults(`/api/giving/reports/${id}/results`);
  }, [loadResults]);
  const runPreview = useCallback(async (definition: ResultReport) => {
    await loadResults(`/api/giving/reports/preview/results?definition=${encodeURIComponent(JSON.stringify(definition))}`);
  }, [loadResults]);
  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail.id;
      void run(id);
    };
    const previewHandler = (event: Event) => {
      void runPreview((event as CustomEvent<ResultReport>).detail);
    };
    window.addEventListener("giving-report-run", handler);
    window.addEventListener("giving-report-preview", previewHandler);
    return () => {
      window.removeEventListener("giving-report-run", handler);
      window.removeEventListener("giving-report-preview", previewHandler);
    };
  }, [run, runPreview]);

  function exportCsv() {
    if (!report) return;
    const columns = report.columns ?? [];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columns.map((column) => escape(column.label)).join(","),
      ...rows.map((row) => columns.map((column) => escape(row[column.key])).join(",")),
    ].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${report.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportGivingReportPdf() {
    if (!report || report.reportType !== "giving-report") return;
    const givingRows = rows as GivingSummaryRow[];
    const rowsBody = [
      [{ text: "Description", bold: true, fillColor: "#e8e1d7" }, { text: "Amount", bold: true, fillColor: "#e8e1d7", alignment: "right" }],
      ...givingRows.map((row) => [{ text: row.categoryName, margin: [row.parentName ? 14 : 0, 0, 0, 0] }, { text: money(row.amount), alignment: "right" }]),
    ];
    const generalRows = givingRows.filter((row) => row.section === "general");
    const nonBudgetRows = givingRows.filter((row) => row.section === "nonBudget");
    const chartSvg = report.criteria?.chart === true && groupingCounts.length > 0
      ? reportChartSvg("Giving breakdown", groupingCounts, report.criteria?.chartType ?? "bar", {}, report.grouping?.aggregation === "sumAmount" ? "currency" : "number")
      : "";
    const tableRows = (sectionRows: GivingSummaryRow[]) => [
      rowsBody[0],
      ...sectionRows.map((row) => [{ text: row.categoryName, margin: [row.parentName ? 14 : 0, 0, 0, 0] }, { text: money(row.amount), alignment: "right" }]),
    ];
    pdf.createPdf({
      pageSize: "LETTER",
      pageMargins: [54, 42, 54, 42],
      content: [
        { text: "Funds Report", alignment: "center", bold: true, fontSize: 16 },
        { text: [report.criteria?.dateFrom, report.criteria?.dateTo].filter(Boolean).join(" to "), alignment: "center", fontSize: 10, margin: [0, 6, 0, 16] },
        ...(chartSvg ? [{ svg: chartSvg, margin: [0, 0, 0, 10] }] : []),
        { text: "GENERAL FUND GIVING", bold: true, fontSize: 11, margin: [0, 0, 0, 5] },
        { table: { widths: ["*", 90], body: tableRows(generalRows) }, layout: "lightHorizontalLines" },
        { text: "NON-BUDGET GIVING", bold: true, fontSize: 11, margin: [0, 14, 0, 5] },
        { table: { widths: ["*", 90], body: [...tableRows(nonBudgetRows), [{ text: "TOTAL RECEIPTS", bold: true }, { text: money(summary?.amount ?? 0), bold: true, alignment: "right" }]] }, layout: "lightHorizontalLines" },
      ],
      styles: {},
    }).download("giving-report.pdf");
  }

  function statementPdfContent(statement: Statement) {
    const columns = ["Date", "Category", "Amount", "Deductible"];
    const body = [
      columns.map((text) => ({ text, bold: true, fillColor: "#e8e1d7" })),
      ...statement.rows.map((row) => [row.date, row.category, { text: money(row.amount), alignment: "right" }, row.deductible ? "Yes" : "No"]),
      [{ text: "TOTAL DEDUCTIBLE", bold: true, fontSize: 8, noWrap: true }, "", { text: money(statement.totals.deductible), bold: true, alignment: "right" }, ""],
      [{ text: "TOTAL NON-DEDUCTIBLE", bold: true, fontSize: 8, noWrap: true }, "", { text: money(statement.totals.nondeductible), bold: true, alignment: "right" }, ""],
      [{ text: "TOTAL CONTRIBUTIONS", bold: true, fontSize: 8, noWrap: true }, "", { text: money(statement.totals.total), bold: true, alignment: "right" }, ""],
    ];
    return [
        { text: statement.church.name, style: "church" },
        { text: [statement.church.addressStreet, [statement.church.addressCity, statement.church.addressState, statement.church.addressZip].filter(Boolean).join(", ")].filter(Boolean).join("\n"), alignment: "center", fontSize: 9 },
        { text: [statement.church.phone, statement.church.email, statement.church.taxId ? `Tax ID: ${statement.church.taxId}` : ""].filter(Boolean).join("  |  "), alignment: "center", fontSize: 8, margin: [0, 2, 0, 12] },
        { text: "Contribution Statement", style: "title" },
        { text: `${statement.household.name}\n${statement.household.addressStreet}\n${[statement.household.addressCity, statement.household.addressState, statement.household.addressZip].filter(Boolean).join(", ")}\nEnvelope ${statement.envelopeNumber}`, style: "household", margin: [0, 0, 0, 14] },
        { table: { headerRows: 1, widths: [130, "*", 85, 65], body }, layout: "lightHorizontalLines" },
        { text: ["This statement is provided for your tax records. Please retain it with your other charitable contribution records.", "\nOther than intangible religious benefits, no goods or services were received in exchange for these contributions."], style: "note" },
    ];
  }

  function exportStatementsPdf() {
    if (!statements.length) return;
    const content = statements.flatMap((statement, index) => [
      ...(index > 0 ? [{ text: "", pageBreak: "before" as const }] : []),
      ...statementPdfContent(statement),
    ]);
    pdf.createPdf({
      pageSize: "LETTER", pageMargins: [36, 36, 36, 44],
      footer: () => ({ text: `Printed ${new Date().toLocaleDateString()}`, alignment: "left", margin: [36, 0, 36, 18], fontSize: 8, color: "#555555" }),
      content,
      styles: { church: { alignment: "center", bold: true, fontSize: 15 }, title: { alignment: "center", bold: true, fontSize: 18, margin: [0, 0, 0, 12] }, household: { fontSize: 10 }, note: { fontSize: 8, color: "#555555", margin: [0, 12, 0, 0] } }
    }).download("contribution-statements.pdf");
  }

  if (!open) return null;
  return (
    <div className="contribution-statements-overlay fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4 sm:p-8" role="dialog" aria-modal="true">
      <div className="contribution-statements-dialog mx-auto min-h-[calc(100vh-2rem)] w-full max-w-[96rem] rounded-2xl bg-white p-5 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Report results</h2>
            <p className="mt-1 text-sm text-ink/60">{report?.name ?? "Giving report"}</p>
          </div>
          <div className="flex gap-2">
            {rows.length > 0 && <Button type="button" variant="secondary" onClick={exportCsv}>Export CSV</Button>}
            {report?.reportType === "giving-report" && rows.length > 0 && <Button type="button" onClick={exportGivingReportPdf}>Export PDF</Button>}
            {report?.reportType === "contribution-statements" && statements.length > 0 && <Button type="button" onClick={exportStatementsPdf}>Export PDF</Button>}
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </div>
        {error && <Notification variant="danger" className="mt-4">{error}</Notification>}
        {unavailable ? (
          <p className="mt-6 rounded-xl border border-dashed border-ink/15 p-8 text-center text-sm text-ink/60">
            This report is reserved for a future statement workflow.
          </p>
        ) : report?.reportType === "contribution-statements" ? (
          <div className="contribution-statements-list mt-6 grid gap-8">
            {statements.length ? statements.map((statement) => <ContributionStatement key={statement.id} statement={statement} />) : <p className="rounded-xl border border-dashed border-ink/15 p-8 text-center text-sm text-ink/60">No contribution statements match this report.</p>}
          </div>
        ) : report?.reportType === "giving-report" ? (
          <GivingSummaryReport report={report} rows={rows as GivingSummaryRow[]} summary={summary} />
        ) : report ? (
          <>
          {report.criteria?.chart === true && report.grouping?.key && groupingCounts.length > 0 && <div className="mt-5"><ReportSummaryChart title={`Breakdown by ${report.columns.find((column) => column.key === report.grouping?.key)?.label ?? report.grouping.key}`} items={groupingCounts} noun="rows" chartType={report.criteria?.chartType ?? "bar"} valueFormat={report.grouping.aggregation === "sumAmount" ? "currency" : "number"} mode={report.criteria?.chartType === "line" ? "trend" : "distribution"} />{report.criteria?.chartOnly && <div className="mt-3"><ReportChartExportActions title={`Breakdown by ${report.columns.find((column) => column.key === report.grouping?.key)?.label ?? report.grouping.key}`} reportName={report.name} items={groupingCounts} chartType={report.criteria?.chartType} valueFormat={report.grouping.aggregation === "sumAmount" ? "currency" : "number"} /></div>}</div>}
          {!report.criteria?.chartOnly && <ReportDataTable rows={rows} columns={report.columns} sort={report.columns[0]?.key ?? ""} direction="asc" layout={layout} reportName={report.name} generatedAt={report.generatedAt ?? new Date().toISOString()} generatedBy={report.generatedBy ?? ""} reportPeriod={{ from: report.criteria?.dateFrom, to: report.criteria?.dateTo }} summaryChart={report.criteria?.chart === true && groupingCounts.length > 0 ? { title: "Giving breakdown", items: groupingCounts, chartType: report.criteria?.chartType, valueFormat: report.grouping?.aggregation === "sumAmount" ? "currency" : "number" } : undefined} onLayoutChange={(next) => {
            const merged = { ...layout, ...next, widths: { ...layout.widths, ...next.widths }, visibility: { ...layout.visibility, ...next.visibility } };
            setLayout(merged);
            if (report.id !== "preview") void fetch(`/api/giving/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: merged }) });
          }} />}
          </>
        ) : null}
      </div>
    </div>
  );
}

function GivingSummaryReport({ report, rows, summary }: { report: ResultReport; rows: GivingSummaryRow[]; summary: { total: number; amount: number } | null }) {
  const renderSection = (title: string, section: "general" | "nonBudget") => {
    const sectionRows = rows.filter((row) => row.section === section);
    return <section className="mt-5 first:mt-0" key={section}>
      <h3 className="border-b border-ink/20 pb-1 text-sm font-semibold uppercase tracking-wide">{title}</h3>
      <div className="mt-1 divide-y divide-ink/10">
        {sectionRows.map((row) => <div className="flex items-center justify-between gap-4 py-1.5 text-sm" key={row.id}><span className={row.parentName ? "pl-4" : ""}>{row.categoryName}</span><span className="font-medium tabular-nums">{money(row.amount)}</span></div>)}
        {!sectionRows.length && <p className="py-2 text-sm text-ink/55">No giving recorded.</p>}
      </div>
    </section>;
  };
  return <section className="giving-summary-report mx-auto mt-6 max-w-3xl rounded-xl border border-ink/15 bg-white p-6 shadow-sm">
    <header className="text-center"><h3 className="font-serif text-2xl">{report.name || "Funds Report"}</h3><p className="mt-1 text-sm text-ink/60">{[report.criteria?.dateFrom, report.criteria?.dateTo].filter(Boolean).join(" to ") || "All posted contributions"}</p></header>
    <div className="mt-6">{renderSection("General Fund Giving", "general")}{renderSection("Non-Budget Giving", "nonBudget")}</div>
    <div className="mt-5 flex justify-between border-t-2 border-ink/30 pt-2 text-sm font-bold"><span>Total receipts</span><span className="tabular-nums">{money(summary?.amount ?? 0)}</span></div>
  </section>;
}

function ContributionStatement({ statement }: { statement: Statement }) {
  return <article className="contribution-statement bg-white p-5 text-sm shadow-sm sm:p-8">
    <header className="statement-header text-center"><h3 className="font-serif text-xl font-semibold">{statement.church.name}</h3><p>{statement.church.addressStreet}</p><p>{[statement.church.addressCity, statement.church.addressState, statement.church.addressZip].filter(Boolean).join(", ")}</p><p className="text-xs text-ink/65">{[statement.church.phone, statement.church.email, statement.church.taxId ? `Tax ID: ${statement.church.taxId}` : ""].filter(Boolean).join("  |  ")}</p><h2 className="mt-4 font-serif text-2xl font-bold">Contribution Statement</h2></header>
    <section className="mt-6 border-y border-ink/15 py-3"><p className="font-semibold">{statement.household.name}</p><p>{statement.household.addressStreet}</p><p>{[statement.household.addressCity, statement.household.addressState, statement.household.addressZip].filter(Boolean).join(", ")}</p><p className="text-xs text-ink/60">Envelope {statement.envelopeNumber}</p></section>
    <table className="mt-6 w-full border-collapse text-xs"><thead><tr className="border-b-2 border-ink/40 text-left"><th className="px-2 py-2">Date</th><th className="px-2 py-2">Category</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2">Deductible</th></tr></thead><tbody>{statement.rows.map((row) => <tr key={row.id} className="border-b border-ink/10"><td className="px-2 py-1.5">{row.date}</td><td className="px-2 py-1.5">{row.category}</td><td className="px-2 py-1.5 text-right">{money(row.amount)}</td><td className="px-2 py-1.5">{row.deductible ? "Yes" : "NO — non-deductible"}</td></tr>)}<tr className="border-t-2 border-ink/30 font-semibold"><td colSpan={2} className="px-2 py-2">Total deductible</td><td className="px-2 py-2 text-right">{money(statement.totals.deductible)}</td><td /></tr><tr className="font-semibold"><td colSpan={2} className="px-2 py-2">Total non-deductible</td><td className="px-2 py-2 text-right">{money(statement.totals.nondeductible)}</td><td /></tr><tr className="border-t-2 border-ink/40 font-bold"><td colSpan={2} className="px-2 py-2">Total contributions</td><td className="px-2 py-2 text-right">{money(statement.totals.total)}</td><td /></tr></tbody></table>
    <p className="mt-6 text-xs text-ink/60">This statement is provided for your tax records. Please retain it with your other charitable contribution records.<br />Other than intangible religious benefits, no goods or services were received in exchange for these contributions.</p>
    <footer className="statement-footer mt-8 hidden border-t border-ink/15 pt-2 text-[10px] text-ink/50 print:block">Printed {new Date().toLocaleDateString()}</footer>
  </article>;
}
