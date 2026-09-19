"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button, Notification } from "@/components/ui";
import { ReportSummaryChart } from "@/components/report-summary-chart";
import { ReportChartExportActions } from "@/components/report-chart-export-actions";
import type { MembershipReportLayout } from "@/lib/membership-reporting";

const ReportDataTable = dynamic(() => import("../../membership/reports/report-data-table").then((module) => module.ReportDataTable), { ssr: false });
type Report = { id: string; name: string; reportType: string; criteria?: { chart?: boolean; chartOnly?: boolean; chartType?: "bar" | "line" | "pie" }; columns: { key: string; label: string }[]; grouping?: string; groupingCounts?: { label: string; count: number }[]; sort?: { key: string; direction: "asc" | "desc" }[]; layout?: MembershipReportLayout };
type Row = { id: string; [key: string]: string | number };
type Summary = { attendance: number; absences: number; visitors: number; volunteerAssignments: number };

export function EventReportResults() {
  const [reports, setReports] = useState<Report[]>([]); const [reportId, setReportId] = useState(""); const [report, setReport] = useState<Report | null>(null); const [rows, setRows] = useState<Row[]>([]); const [summary, setSummary] = useState<Summary | null>(null); const [error, setError] = useState(""); const [open, setOpen] = useState(false); const [preview, setPreview] = useState<Record<string, unknown> | null>(null); const [resultVersion, setResultVersion] = useState(0);
  async function loadReports(preferredId?: string) { const response = await fetch("/api/events/reports", { cache: "no-store" }); const value = await response.json(); const next = value.reports ?? []; setReports(next); const selected = next.find((item: Report) => item.id === preferredId) ?? next[0]; if (selected && !reportId) setReportId(selected.id); }
  useEffect(() => { void loadReports(); const updated = () => void loadReports(); const previewHandler = (event: Event) => { const definition = (event as CustomEvent<Record<string, unknown>>).detail; setPreview(definition); void run("preview", definition); }; const runHandler = (event: Event) => { const id = (event as CustomEvent<{ id: string }>).detail.id; void run(id); }; window.addEventListener("event-reports-updated", updated); window.addEventListener("event-report-preview", previewHandler); window.addEventListener("event-report-run", runHandler); return () => { window.removeEventListener("event-reports-updated", updated); window.removeEventListener("event-report-preview", previewHandler); window.removeEventListener("event-report-run", runHandler); }; }, []);
  async function run(id: string, definition = preview) {
    setError(""); setOpen(true); const query = id === "preview" && definition ? `?definition=${encodeURIComponent(JSON.stringify(definition))}` : ""; const response = await fetch(`/api/events/reports/${id}/results${query}`, { cache: "no-store" }); const value = await response.json(); if (!response.ok) { setError(value.error ?? "Unable to run report."); return; }
    const selected = id === "preview" ? { ...(definition as Record<string, unknown>), id: "preview", columns: value.report.columns } as Report : reports.find((item) => item.id === id);
    const selectedColumns = (value.report.columns ?? selected?.columns ?? []) as { key: string; label: string }[];
    const normalizedRows = (value.rows ?? []).map((row: Row) => {
      const normalized: Row = { id: String(row.id ?? "") };
      selectedColumns.forEach((column) => { normalized[column.key] = row[column.key] ?? ""; });
      return normalized;
    });
    setReport(selected ? { ...selected, ...value.report, columns: selectedColumns } : null); setReportId(id); setRows(normalizedRows); setResultVersion((version) => version + 1);
    setSummary(value.report.summary ?? null);
  }
  async function saveLayout(nextLayout: MembershipReportLayout) {
    if (!report) return;
    const merged = { ...(report.layout ?? {}), ...nextLayout, widths: { ...(report.layout?.widths ?? {}), ...(nextLayout.widths ?? {}) }, visibility: { ...(report.layout?.visibility ?? {}), ...(nextLayout.visibility ?? {}) } };
    setReport({ ...report, layout: merged });
    if (report.id !== "preview") await fetch(`/api/events/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: merged }) });
  }
  return open ? <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4 sm:p-8" role="dialog" aria-modal="true"><div className="mx-auto min-h-[calc(100vh-2rem)] w-full max-w-[96rem] rounded-2xl bg-white p-5 shadow-2xl sm:p-8"><div className="flex items-center justify-between gap-3"><div><h2 className="font-serif text-2xl">Report results</h2><p className="mt-1 text-sm text-ink/60">Use the table controls to search, reorder, resize, hide, export, print, or save your layout.</p></div><Button type="button" variant="default" onClick={() => setOpen(false)}>Close</Button></div>{error && <Notification variant="danger" className="mt-4">{error}</Notification>}{summary && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Attendance", summary.attendance], ["Absences", summary.absences], ["Visitors", summary.visitors],   ["Volunteer assignments", summary.volunteerAssignments]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-ink/10 bg-mist/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}</div>}{report?.criteria?.chart !== false && report?.grouping && (report.groupingCounts?.length ?? 0) > 0 && <div className="mt-5"><ReportSummaryChart title={`Breakdown by ${report.grouping}`} items={report.groupingCounts ?? []} noun="rows" chartType={report.criteria?.chartType ?? "bar"} mode={report.criteria?.chartType === "line" ? "trend" : "distribution"} />{report.criteria?.chartOnly && <div className="mt-3"><ReportChartExportActions title={`Breakdown by ${report.grouping}`} reportName={report.name} items={report.groupingCounts ?? []} chartType={report.criteria?.chartType} /></div>}</div>}{report && !report.criteria?.chartOnly && <div className="mt-5 overflow-x-auto">  <ReportDataTable key={`event-report-${resultVersion}`} rows={rows} columns={report.columns} sort={report.sort?.[0]?.key ?? "eventStartsAt"} direction={report.sort?.[0]?.direction ?? "desc"} layout={report.layout ?? {}} reportName={report.name} generatedAt={new Date().toISOString()} generatedBy="" summaryChart={report.criteria?.chart !== false && report.grouping && (report.groupingCounts?.length ?? 0) > 0 ? { title: `Breakdown by ${report.grouping}`, items: report.groupingCounts ?? [], chartType: report.criteria?.chartType } : undefined} onLayoutChange={(nextLayout) => void saveLayout(nextLayout)} /></div>}</div></div> : null;
}
