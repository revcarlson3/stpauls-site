"use client";

import { useEffect, useState } from "react";
import { Button, Notification } from "@/components/ui";
import {
  GIVING_REPORT_COLUMNS,
  GIVING_REPORT_TYPES,
  givingReportPreset,
  givingReportTypeLabel,
  type GivingReportType,
} from "@/lib/giving-reporting";

type Report = {
  id: string;
  name: string;
  description?: string | null;
  reportType: GivingReportType;
  criteria: Record<string, unknown>;
  columns: { key: string; label: string }[];
  grouping?: { key?: string; direction?: "asc" | "desc"; aggregation?: "count" | "sumAmount" };
};
type Condition = { field: string; operator: string; value: string };

const FILTER_FIELDS = [
  ["memberName", "Member name"],
  ["envelopeNumber", "Envelope number"],
  ["categoryCode", "Category code"],
  ["categoryName", "Category"],
  ["pledgeCampaign", "Pledge campaign"],
  ["paymentType", "Payment type"],
  ["amount", "Amount"],
  ["memo", "Memo"],
];
const OPERATORS = [
  ["equals", "equals"],
  ["notEquals", "does not equal"],
  ["contains", "contains"],
  ["greaterOrEqual", "is at least"],
  ["lessOrEqual", "is at most"],
];

export function GivingReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    reportType: "giving-report" as GivingReportType,
    dateFrom: "",
    dateTo: "",
    columns: givingReportPreset("giving-report").columns,
    groupingKey: "",
    groupingDirection: "asc" as "asc" | "desc",
    groupingAggregation: "count" as "count" | "sumAmount",
    chart: false,
    chartOnly: false,
    chartType: "bar" as "bar" | "line" | "pie",
    match: "all" as "all" | "any",
    conditions: [] as Condition[],
  });

  async function load() {
    const response = await fetch("/api/giving/reports", { cache: "no-store" });
    const value = await response.json();
    if (response.ok) setReports(value.reports ?? []);
    else setError(value.error ?? "Unable to load giving reports.");
  }

  useEffect(() => {
    void load();
  }, []);

  function chooseType(reportType: GivingReportType) {
    const preset = givingReportPreset(reportType);
    setForm((current) => ({ ...current, reportType, columns: preset.columns }));
  }

  function reset() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      reportType: "giving-report",
      dateFrom: "",
      dateTo: "",
      columns: givingReportPreset("giving-report").columns,
      groupingKey: "",
      groupingDirection: "asc",
      groupingAggregation: "count",
      chart: false,
      chartOnly: false,
      chartType: "bar",
      match: "all",
      conditions: [],
    });
  }

  function edit(report: Report) {
    setEditing(report.id);
    setLastSavedId(report.id);
    setForm({
      name: report.name,
      description: report.description ?? "",
      reportType: report.reportType,
      dateFrom: String(report.criteria?.dateFrom ?? ""),
      dateTo: String(report.criteria?.dateTo ?? ""),
      columns: report.columns?.length ? report.columns : givingReportPreset(report.reportType).columns,
      groupingKey: report.grouping?.key ?? "",
      groupingDirection: report.grouping?.direction ?? "asc",
      groupingAggregation: report.grouping?.aggregation ?? "count",
      chart: report.criteria?.chart === true,
      chartOnly: report.criteria?.chartOnly === true,
      chartType: report.criteria?.chartType === "line" || report.criteria?.chartType === "pie" ? report.criteria.chartType : "bar",
      match: report.criteria?.match === "any" ? "any" : "all",
      conditions: Array.isArray(report.criteria?.conditions) ? report.criteria.conditions as Condition[] : [],
    });
  }

  async function persist(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setMessage("");
    const response = await fetch(editing ? `/api/giving/reports/${editing}` : "/api/giving/reports", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        reportType: form.reportType,
        columns: form.columns,
        sort: [{ key: givingReportPreset(form.reportType).sortKey, direction: givingReportPreset(form.reportType).sortDirection }],
        grouping: form.groupingKey ? { key: form.groupingKey, direction: form.groupingDirection, aggregation: form.groupingAggregation } : {},
        criteria: { dateFrom: form.dateFrom, dateTo: form.dateTo, match: form.match, conditions: form.conditions, chart: form.chart, chartOnly: form.chartOnly, chartType: form.chartType },
      }),
    });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error ?? "Unable to save report.");
      return;
    }
    setMessage(editing ? "Report updated." : "Report saved.");
    const savedId = value.report?.id ?? editing;
    setLastSavedId(savedId);
    reset();
    await load();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    await persist(event);
  }

  function runOnce() {
    window.dispatchEvent(new CustomEvent("giving-report-preview", {
      detail: {
        name: form.name.trim() || "One-time report",
        reportType: form.reportType,
        columns: form.columns,
        sort: [{ key: givingReportPreset(form.reportType).sortKey, direction: givingReportPreset(form.reportType).sortDirection }],
        grouping: form.groupingKey ? { key: form.groupingKey, direction: form.groupingDirection, aggregation: form.groupingAggregation } : {},
        criteria: { dateFrom: form.dateFrom, dateTo: form.dateTo, match: form.match, conditions: form.conditions, chart: form.chart, chartOnly: form.chartOnly, chartType: form.chartType },
      },
    }));
  }

  async function remove(report: Report) {
    if (!window.confirm(`Delete the "${report.name}" report?`)) return;
    await fetch(`/api/giving/reports/${report.id}`, { method: "DELETE" });
    await load();
  }

  function run(id: string) {
    window.dispatchEvent(new CustomEvent("giving-report-run", { detail: { id } }));
  }

  async function duplicate(report: Report) {
    const response = await fetch("/api/giving/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${report.name} (Copy)`.slice(0, 120), description: report.description ?? "", reportType: report.reportType, criteria: report.criteria, columns: report.columns, sort: [{ key: givingReportPreset(report.reportType).sortKey, direction: givingReportPreset(report.reportType).sortDirection }], grouping: report.grouping ?? {}, layout: {} }),
    });
    if (response.ok) { setMessage("Report duplicated."); await load(); }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
      <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">{editing ? "Edit report" : "Create a report"}</h2>
            <p className="mt-1 text-sm text-ink/60">Choose a giving report template or customize the data-table columns.</p>
          </div>
          {editing && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}
        </div>
        {error && <Notification variant="danger" className="mt-4">{error}</Notification>}
        {message && <Notification variant="success" className="mt-4">{message}</Notification>}
        <form onSubmit={(event) => void save(event)} className="mt-5 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold">
            Report name
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="Monthly giving report" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Description
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="focus-ring min-h-20 rounded-lg border border-ink/15 px-3 py-2 font-normal" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Report type
            <select value={form.reportType} onChange={(event) => chooseType(event.target.value as GivingReportType)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">
              {GIVING_REPORT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            <span className="text-xs font-normal text-ink/55">{GIVING_REPORT_TYPES.find((type) => type.value === form.reportType)?.description}</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Date from<input type="date" value={form.dateFrom} onChange={(event) => setForm({ ...form, dateFrom: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Date to<input type="date" value={form.dateTo} onChange={(event) => setForm({ ...form, dateTo: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          </div>
          <div className="grid gap-3 rounded-xl border border-ink/10 p-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Group rows by<select value={form.groupingKey} onChange={(event) => setForm({ ...form, groupingKey: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">No grouping</option>{GIVING_REPORT_COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Group order<select value={form.groupingDirection} onChange={(event) => setForm({ ...form, groupingDirection: event.target.value as "asc" | "desc" })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Group calculation<select value={form.groupingAggregation} onChange={(event) => setForm({ ...form, groupingAggregation: event.target.value as "count" | "sumAmount" })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="count">Count rows</option><option value="sumAmount">Sum amount</option></select></label>
          </div>
          <fieldset className="rounded-xl border border-ink/10 p-4">
            <legend className="px-1 text-sm font-semibold">Chart</legend>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.chart} onChange={(event) => setForm({ ...form, chart: event.target.checked, chartOnly: event.target.checked ? form.chartOnly : false })} />            Enable chart in results</label>
            {form.chart && <><label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.chartOnly} onChange={(event) => setForm({ ...form, chartOnly: event.target.checked })} />Show chart only (hide table)</label><label className="mt-3 grid gap-1 text-sm font-semibold">Chart type<select value={form.chartType} onChange={(event) => setForm({ ...form, chartType: event.target.value as "bar" | "line" | "pie" })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="bar">Bar</option><option value="line">Line</option><option value="pie">Pie</option></select></label></>}
          </fieldset>
          {form.reportType === "custom" && (
            <fieldset className="rounded-xl border border-ink/10 p-4">
              <legend className="px-1 text-sm font-semibold">Columns</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {GIVING_REPORT_COLUMNS.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.columns.some((item) => item.key === column.key)} onChange={(event) => setForm({ ...form, columns: event.target.checked ? [...form.columns, column] : form.columns.filter((item) => item.key !== column.key) })} />
                    {column.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className="rounded-xl border border-ink/10 p-4">
            <legend className="px-1 text-sm font-semibold">Filters</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink/55">Use filters to run a statement for one member or narrow the report to a specific designation.</p>
              <div className="flex items-center gap-2">
                <select value={form.match} onChange={(event) => setForm({ ...form, match: event.target.value as "all" | "any" })} className="focus-ring rounded-lg border border-ink/15 px-2 py-1 text-sm">
                  <option value="all">Match all</option>
                  <option value="any">Match any</option>
                </select>
                <button type="button" onClick={() => setForm({ ...form, conditions: [...form.conditions, { field: "memberName", operator: "contains", value: "" }] })} className="focus-ring rounded-full border border-coral px-3 py-1 text-sm font-semibold text-coral">
                  Add filter
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {form.conditions.map((condition, index) => (
                <div key={`${condition.field}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <select value={condition.field} onChange={(event) => setForm({ ...form, conditions: form.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value, value: "" } : item) })} className="focus-ring rounded-lg border border-ink/15 px-2 py-2 text-sm">
                    {FILTER_FIELDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <select value={condition.operator} onChange={(event) => setForm({ ...form, conditions: form.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value } : item) })} className="focus-ring rounded-lg border border-ink/15 px-2 py-2 text-sm">
                    {OPERATORS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input value={condition.value} onChange={(event) => setForm({ ...form, conditions: form.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} className="focus-ring rounded-lg border border-ink/15 px-2 py-2 text-sm" placeholder={condition.field === "amount" ? "0.00" : "Value"} />
                  <button type="button" onClick={() => setForm({ ...form, conditions: form.conditions.filter((_, itemIndex) => itemIndex !== index) })} className="focus-ring rounded-lg px-2 text-sm font-semibold text-coral">Remove</button>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{editing ? "Save changes" : "Save report"}</Button>
            <Button type="button" variant="default" onClick={runOnce}>Run now</Button>
          </div>
        </form>
      </section>
      <aside className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-2xl">Saved reports</h2>
        <div className="mt-5 grid gap-3">
          {reports.length ? reports.map((report) => (
            <div key={report.id} className="rounded-xl border border-ink/10 p-4">
              <button type="button" className="text-left font-semibold underline-offset-2 hover:underline" onClick={() => run(report.id)}>{report.name}</button>
              <p className="mt-1 text-xs text-ink/55">{givingReportTypeLabel(report.reportType)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => run(report.id)} className="focus-ring rounded-full bg-coral px-3 py-2 text-sm font-semibold text-white">Run</button>
                <button type="button" onClick={() => edit(report)} className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm font-semibold">Edit</button>
                <button type="button" onClick={() => void duplicate(report)} className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral">Duplicate</button>
                <button type="button" onClick={() => void remove(report)} className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral">Delete</button>
              </div>
            </div>
          )) : <p className="text-sm text-ink/55">No saved giving reports yet.</p>}
        </div>
      </aside>
    </div>
  );
}
