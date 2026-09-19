"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button, Notification } from "@/components/ui";
import type { MembershipReportLayout } from "@/lib/membership-reporting";
import { ReportSummaryChart } from "@/components/report-summary-chart";
import { ReportChartExportActions } from "@/components/report-chart-export-actions";

const ReportDataTable = dynamic(() => import("./report-data-table").then((module) => module.ReportDataTable), { ssr: false });

type Report = { id: string; name: string; reportType?: string; criteria?: { chart?: boolean; chartOnly?: boolean; chartType?: "bar" | "line" | "pie" }; sort?: { key: string; direction: "asc" | "desc" }[]; layout?: MembershipReportLayout };
type Result = { id: string; [key: string]: string | number };
type Column = { key: string; label: string };
type GroupCount = { label: string; count: number };
type ReportSummary = { total: number; active: number; inactive: number };

export function ReportResults() {
  const [reports, setReports] = useState<Report[]>([]);
  const [reportId, setReportId] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Result[]>([]);
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [layout, setLayout] = useState<MembershipReportLayout>({});
  const [layoutMessage, setLayoutMessage] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [generatedBy, setGeneratedBy] = useState("");
  const [reportType, setReportType] = useState("");
  const [grouping, setGrouping] = useState("");
  const [groupingCounts, setGroupingCounts] = useState<GroupCount[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);

  const loadReports = useCallback(async (preferredId?: string) => {
    const response = await fetch("/api/membership/reports", { cache: "no-store" });
    const value = await response.json();
    const nextReports = value.reports ?? [];
    setReports(nextReports);
    const selected = nextReports.find((report: Report) => report.id === preferredId) ?? nextReports.find((report: Report) => report.id === reportId) ?? nextReports[0];
    if (selected) {
      setReportId(selected.id);
      setSort(selected.sort?.[0]?.key ?? "name");
      setDirection(selected.sort?.[0]?.direction ?? "asc");
      setLayout(selected.layout ?? {});
    } else {
      setReportId("");
    }
  }, [reportId]);

  const runPreview = useCallback(async (definition: Record<string, unknown>) => {
    setError("");
    const response = await fetch(`/api/membership/reports/preview/results?definition=${encodeURIComponent(JSON.stringify(definition))}&page=1&pageSize=10000&sort=name&direction=asc&_=${Date.now()}`, { cache: "no-store" });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to run report."); return; }
    setColumns(value.report.columns ?? []);
    setRows(value.rows ?? []);
    setLayout(value.report.layout ?? {});
    setGeneratedAt(value.report.generatedAt ?? new Date().toISOString());
    setGeneratedBy(value.report.generatedBy ?? "");
    setReportType(value.report.reportType ?? "");
    setGrouping(value.report.grouping ?? "");
    setGroupingCounts(value.report.groupingCounts ?? []);
    setSummary(value.report.summary ?? null);
  }, []);

  function selectReport(id: string) {
    const report = reports.find((item) => item.id === id);
    setReportId(id);
    setSort(report?.sort?.[0]?.key ?? "name");
    setDirection(report?.sort?.[0]?.direction ?? "asc");
    setLayout(report?.layout ?? {});
  }

  const run = useCallback(async (targetId = reportId, previewDefinition = preview) => {
    if (!targetId) return;
    setReportId(targetId);
    setOpen(true);
    if (targetId === "preview" && previewDefinition) {
      await runPreview(previewDefinition);
      return;
    }
    const selectedReport = reports.find((report) => report.id === targetId);
    const requestedSort = selectedReport?.sort?.[0]?.key ?? sort;
    const requestedDirection = selectedReport?.sort?.[0]?.direction ?? direction;
    setSort(requestedSort);
    setDirection(requestedDirection);
    setError("");
    setGrouping("");
    setGroupingCounts([]);
    setSummary(null);
    const response = await fetch(`/api/membership/reports/${targetId}/results?page=1&pageSize=10000&sort=${encodeURIComponent(requestedSort)}&direction=${requestedDirection}&_=${Date.now()}`, { cache: "no-store" });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to run report."); return; }
    setColumns(value.report.columns ?? []);
    setRows(value.rows ?? []);
    setLayout(value.report.layout ?? {});
    setGeneratedAt(value.report.generatedAt ?? new Date().toISOString());
    setGeneratedBy(value.report.generatedBy ?? "");
    setReportType(value.report.reportType ?? "");
    setGrouping(value.report.grouping ?? "");
    setGroupingCounts(value.report.groupingCounts ?? []);
    setSummary(value.report.summary ?? null);
  }, [direction, preview, reportId, reports, runPreview, sort]);

  useEffect(() => {
    void loadReports();
    const handleReportsUpdated = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      void loadReports(id);
    };
    window.addEventListener("membership-reports-updated", handleReportsUpdated);
    const handlePreview = (event: Event) => {
      const definition = (event as CustomEvent<Record<string, unknown>>).detail;
      setPreview(definition);
      void run("preview", definition);
    };
    const handleRun = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) void run(id);
    };
    window.addEventListener("membership-report-preview", handlePreview);
    window.addEventListener("membership-report-run", handleRun);
    return () => {
      window.removeEventListener("membership-reports-updated", handleReportsUpdated);
      window.removeEventListener("membership-report-preview", handlePreview);
      window.removeEventListener("membership-report-run", handleRun);
    };
  }, [loadReports, run]);

  async function saveLayout(nextLayout: MembershipReportLayout) {
    if (!reportId) return;
    setLayout(nextLayout);
    if (reportId === "preview") {
      setLayoutMessage("Table layout updated for this report.");
      return;
    }
    const response = await fetch(`/api/membership/reports/${reportId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: nextLayout }) });
    setLayoutMessage(response.ok ? "Table layout saved." : "Unable to save table layout.");
  }

  const activeCriteria = reportId === "preview" ? preview?.criteria as { chart?: boolean; chartOnly?: boolean; chartType?: "bar" | "line" | "pie" } | undefined : reports.find((item) => item.id === reportId)?.criteria;
  return <>
    {open && <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="report-results-title"><div className="mx-auto min-h-[calc(100vh-2rem)] w-full max-w-[96rem] rounded-2xl bg-white p-5 shadow-2xl sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="report-results-title" className="font-serif text-2xl">Report results</h2><p className="mt-1 text-sm text-ink/60">Results are loaded from the current membership records.</p></div><Button type="button" variant="default" onClick={() => setOpen(false)}>Close</Button></div>
    <div className="mt-4 flex items-center gap-2"><span className="text-sm text-ink/60">{reportId === "preview" ? "One-time report" : reports.find((report) => report.id === reportId)?.name ?? "Report"}</span></div>
    {error && <Notification variant="danger" className="mt-4">{error}</Notification>}
    {summary && <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-ink/10 bg-mist/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{reportType === "family-overview" ? "Matching families" : reportType === "attendance-participation" ? "Attendance records" : reportType === "service-history" ? "Service records" : "Matching members"}</p><p className="mt-1 text-2xl font-semibold">{summary.total}</p></div><div className="rounded-xl border border-ink/10 bg-mist/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{reportType === "attendance-participation" ? "Present" : reportType === "service-history" ? "Completed" : "Active"}</p><p className="mt-1 text-2xl font-semibold">{summary.active}</p></div><div className="rounded-xl border border-ink/10 bg-mist/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{reportType === "attendance-participation" ? "Absent or excused" : reportType === "service-history" ? "No-show" : "Other statuses"}</p><p className="mt-1 text-2xl font-semibold">{summary.inactive}</p></div></div>}
    {grouping && groupingCounts.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{groupingCounts.map((group) => <div key={group.label} className="rounded-xl border border-ink/10 bg-mist/30 p-3"><p className="truncate text-xs font-semibold uppercase tracking-wide text-ink/55">{group.label}</p><p className="mt-1 text-2xl font-semibold">{group.count}</p><p className="text-xs text-ink/55">{reportType === "family-overview" ? "families" : reportType === "attendance-participation" || reportType === "service-history" ? "records" : "members"}</p></div>)}</div>}
    {activeCriteria?.chart === true && grouping && groupingCounts.length > 0 && <div className="mt-5"><ReportSummaryChart title={`Breakdown by ${columns.find((column) => column.key === grouping)?.label ?? grouping}`} items={groupingCounts} noun={reportType === "family-overview" ? "families" : reportType === "attendance-participation" || reportType === "service-history" ? "records" : "members"} chartType={activeCriteria?.chartType ?? "bar"} mode={activeCriteria?.chartType === "line" ? "trend" : "distribution"} />{activeCriteria?.chartOnly && <div className="mt-3"><ReportChartExportActions title={`Breakdown by ${columns.find((column) => column.key === grouping)?.label ?? grouping}`} reportName={reports.find((report) => report.id === reportId)?.name ?? "Membership report"} items={groupingCounts} chartType={activeCriteria?.chartType} generatedLabel={generatedAt ? `Generated ${new Date(generatedAt).toLocaleString()}` : undefined} /></div>}</div>}
    {rows.length > 0 && !activeCriteria?.chartOnly && <div className="mt-5 overflow-x-auto"><ReportDataTable key={`${reportId}-${columns.map((column) => column.key).join("-")}`} rows={rows} columns={columns} sort={sort} direction={direction} layout={layout} reportName={reports.find((report) => report.id === reportId)?.name ?? (reportId === "preview" ? "One-time report" : "Membership report")} generatedAt={generatedAt} generatedBy={generatedBy} summaryChart={activeCriteria?.chart === true && grouping && groupingCounts.length > 0 ? { title: `Breakdown by ${columns.find((column) => column.key === grouping)?.label ?? grouping}`, items: groupingCounts, chartType: activeCriteria?.chartType } : undefined} onLayoutChange={(nextLayout) => void saveLayout({ ...layout, ...nextLayout, widths: { ...layout.widths, ...nextLayout.widths }, visibility: { ...layout.visibility, ...nextLayout.visibility } })} /></div>}
    {layoutMessage && <p className="mt-2 text-xs text-ink/55">{layoutMessage}</p>}</div></div>}
  </>;
}
