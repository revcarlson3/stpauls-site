"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button, Notification } from "@/components/ui";
import type { MembershipReportLayout } from "@/lib/membership-reporting";
import { ReportSummaryChart } from "@/components/report-summary-chart";

const ReportDataTable = dynamic(() => import("./report-data-table").then((module) => module.ReportDataTable), { ssr: false });

type Report = { id: string; name: string; reportType?: string; sort?: { key: string; direction: "asc" | "desc" }[]; layout?: MembershipReportLayout };
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

  async function loadReports(preferredId?: string) {
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
  }

  useEffect(() => {
    void loadReports();
    const handleReportsUpdated = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      void loadReports(id);
    };
    window.addEventListener("membership-reports-updated", handleReportsUpdated);
    return () => window.removeEventListener("membership-reports-updated", handleReportsUpdated);
  }, []);

  function selectReport(id: string) {
    const report = reports.find((item) => item.id === id);
    setReportId(id);
    setSort(report?.sort?.[0]?.key ?? "name");
    setDirection(report?.sort?.[0]?.direction ?? "asc");
    setLayout(report?.layout ?? {});
  }

  async function run() {
    if (!reportId) return;
    setError("");
    setGrouping("");
    setGroupingCounts([]);
    setSummary(null);
    const response = await fetch(`/api/membership/reports/${reportId}/results?page=1&pageSize=10&sort=${encodeURIComponent(sort)}&direction=${direction}&_=${Date.now()}`, { cache: "no-store" });
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
  }

  async function saveLayout(nextLayout: MembershipReportLayout) {
    if (!reportId) return;
    setLayout(nextLayout);
    const response = await fetch(`/api/membership/reports/${reportId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: nextLayout }) });
    setLayoutMessage(response.ok ? "Table layout saved." : "Unable to save table layout.");
  }

  return <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Run a report</h2><p className="mt-1 text-sm text-ink/60">Results are loaded from the current membership records.</p></div><div className="flex flex-wrap gap-2"><select value={reportId} onChange={(event) => selectReport(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm"><option value="">Choose a saved report</option>{reports.map((report) => <option key={report.id} value={report.id}>{report.name}</option>)}</select><Button type="button" onClick={() => void run()}>Run report</Button></div></div>
    {error && <Notification variant="danger" className="mt-4">{error}</Notification>}
    {summary && <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-ink/10 bg-mist/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{reportType === "family-overview" ? "Matching families" : reportType === "attendance-participation" ? "Attendance records" : reportType === "service-history" ? "Service records" : "Matching members"}</p><p className="mt-1 text-2xl font-semibold">{summary.total}</p></div><div className="rounded-xl border border-ink/10 bg-mist/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{reportType === "attendance-participation" ? "Present" : reportType === "service-history" ? "Completed" : "Active"}</p><p className="mt-1 text-2xl font-semibold">{summary.active}</p></div><div className="rounded-xl border border-ink/10 bg-mist/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{reportType === "attendance-participation" ? "Absent or excused" : reportType === "service-history" ? "No-show" : "Other statuses"}</p><p className="mt-1 text-2xl font-semibold">{summary.inactive}</p></div></div>}
    {grouping && groupingCounts.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{groupingCounts.map((group) => <div key={group.label} className="rounded-xl border border-ink/10 bg-mist/30 p-3"><p className="truncate text-xs font-semibold uppercase tracking-wide text-ink/55">{group.label}</p><p className="mt-1 text-2xl font-semibold">{group.count}</p><p className="text-xs text-ink/55">{reportType === "family-overview" ? "families" : reportType === "attendance-participation" || reportType === "service-history" ? "records" : "members"}</p></div>)}</div>}
    {grouping && groupingCounts.length > 0 && <div className="mt-5"><ReportSummaryChart title={`Breakdown by ${columns.find((column) => column.key === grouping)?.label ?? grouping}`} items={groupingCounts} noun={reportType === "family-overview" ? "families" : reportType === "attendance-participation" || reportType === "service-history" ? "records" : "members"} /></div>}
    {rows.length > 0 && <div className="mt-5 overflow-x-auto"><ReportDataTable key={`${reportId}-${columns.map((column) => column.key).join("-")}`} rows={rows} columns={columns} sort={sort} direction={direction} layout={layout} serverUrl={`/api/membership/reports/${reportId}/results?`} reportName={reports.find((report) => report.id === reportId)?.name ?? "Membership report"} generatedAt={generatedAt} generatedBy={generatedBy} onLayoutChange={(nextLayout) => void saveLayout({ ...layout, ...nextLayout, widths: { ...layout.widths, ...nextLayout.widths }, visibility: { ...layout.visibility, ...nextLayout.visibility } })} /></div>}
    {layoutMessage && <p className="mt-2 text-xs text-ink/55">{layoutMessage}</p>}
  </section>;
}
