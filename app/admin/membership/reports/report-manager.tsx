"use client";

import { useEffect, useState } from "react";
import { Button, Notification } from "@/components/ui";
import { DEFAULT_MEMBERSHIP_REPORT_COLUMNS, MEMBERSHIP_REPORT_TYPES, type MembershipReportColumn, type MembershipReportType } from "@/lib/membership-reporting";

type Condition = { field: string; operator: string; value: string };
type SourceType = "" | "dynamic-list" | "volunteer-group" | "manual-list";
type CustomFieldMeta = MembershipReportColumn & { type?: string; options?: string[] };
type Report = { id: string; name: string; description: string | null; reportType: string; criteria: { conditions?: Condition[]; match?: "all" | "any"; sourceType?: SourceType; sourceId?: string }; columns: MembershipReportColumn[]; sort?: { key: string; direction: "asc" | "desc" }[]; grouping?: { key?: string; direction?: "asc" | "desc" }; striped?: boolean; visibility: string; updatedAt: string };

const fields = [
  ["status", "Status"], ["memberType", "Member type"], ["familyRole", "Family role"], ["city", "City"], ["firstName", "First name"], ["lastName", "Last name"], ["email", "Email"], ["emailConsent", "Email consent"], ["smsConsent", "SMS consent"], ["birthdayMonth", "Birthday month"], ["birthdayYear", "Birthday year"], ["weddingDate", "Has wedding date"], ["deceasedDate", "Has deceased date"], ["gradeLevel", "Grade level"]
];
const operators = [["equals", "equals"], ["notEquals", "does not equal"], ["contains", "contains"], ["greaterOrEqual", "is at least"], ["lessOrEqual", "is at most"]];
const column = (key: string) => DEFAULT_MEMBERSHIP_REPORT_COLUMNS.find((item) => item.key === key);

function reportPreset(reportType: MembershipReportType) {
  const presets: Record<MembershipReportType, { columns: string[]; conditions: Condition[]; sortKey: string; sortDirection: "asc" | "desc"; groupingKey: string }> = {
    "membership-overview": { columns: ["memberNumber", "name", "familyName", "status", "memberType", "email", "cellphone"], conditions: [], sortKey: "name", sortDirection: "asc", groupingKey: "status" },
    "family-overview": { columns: ["familyName", "status", "memberCount", "activeMemberCount", "addressStreet", "city", "state", "zip", "otherPhone"], conditions: [], sortKey: "familyName", sortDirection: "asc", groupingKey: "status" },
    "age-grade-distribution": { columns: ["name", "familyName", "ageCategory", "gradeLevel", "birthMonthDay", "status"], conditions: [], sortKey: "ageCategory", sortDirection: "asc", groupingKey: "ageCategory" },
    "member-type-distribution": { columns: ["name", "familyName", "memberType", "status", "memberNumber"], conditions: [], sortKey: "memberType", sortDirection: "asc", groupingKey: "memberType" },
    "missing-information": { columns: ["name", "familyName", "email", "cellphone", "addressStreet", "city", "state", "zip"], conditions: [{ field: "email", operator: "equals", value: "" }], sortKey: "familyName", sortDirection: "asc", groupingKey: "status" },
    "volunteer-participation": { columns: ["name", "familyName", "status", "volunteerGroups", "volunteerGroupCount", "volunteerRoles", "volunteerLeader"], conditions: [], sortKey: "name", sortDirection: "asc", groupingKey: "volunteerGroups" },
    "service-history": { columns: ["name", "memberNumber", "serviceOpportunity", "serviceGroup", "shiftStartsAt", "serviceRole", "serviceOutcome", "minutesServed"], conditions: [], sortKey: "shiftStartsAt", sortDirection: "desc", groupingKey: "serviceOutcome" },
    "audience-membership": { columns: ["name", "familyName", "status", "memberType", "email"], conditions: [], sortKey: "name", sortDirection: "asc", groupingKey: "status" },
    "messaging-delivery": { columns: ["name", "messageSubject", "messageChannel", "deliveryStatus", "attemptCount", "deliveredAt", "failureReason"], conditions: [], sortKey: "deliveryStatus", sortDirection: "asc", groupingKey: "deliveryStatus" },
    "attendance-participation": { columns: ["name", "memberNumber", "eventTitle", "eventStartsAt", "eventType", "attendanceStatus", "minutesParticipated"], conditions: [], sortKey: "eventStartsAt", sortDirection: "desc", groupingKey: "attendanceStatus" },
    custom: { columns: DEFAULT_MEMBERSHIP_REPORT_COLUMNS.map((item) => item.key), conditions: [], sortKey: "birthMonthDay", sortDirection: "asc", groupingKey: "" }
  };
  const preset = presets[reportType];
  return { ...preset, columns: preset.columns.map(column).filter((item): item is MembershipReportColumn => Boolean(item)) };
}

export function ReportManager() {
  const [reports, setReports] = useState<Report[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomFieldMeta[]>([]);
  const [reference, setReference] = useState<{ types: { id: string; name: string }[]; roles: { id: string; name: string }[] }>({ types: [], roles: [] });
  const [volunteerGroups, setVolunteerGroups] = useState<{ id: string; name: string }[]>([]);
  const [sources, setSources] = useState<{ type: Exclude<SourceType, "">; id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", reportType: "custom" as MembershipReportType, visibility: "PRIVATE", sourceType: "" as SourceType, sourceId: "", match: "all" as "all" | "any", conditions: [] as Condition[], columns: DEFAULT_MEMBERSHIP_REPORT_COLUMNS, sortKey: "birthMonthDay", sortDirection: "asc" as "asc" | "desc", groupingKey: "", groupingDirection: "asc" as "asc" | "desc" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function importReports(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const response = await fetch("/api/membership/reports/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: await file.text() });
      const value = await response.json();
      if (!response.ok) { setError(value.error ?? "Unable to import reports."); return; }
      setMessage(`${value.reports?.length ?? 0} report(s) imported.`);
      await load();
      window.dispatchEvent(new CustomEvent("membership-reports-updated"));
    } catch {
      setError("The selected report file could not be read.");
    }
  }

  async function load() {
    const [response, fieldsResponse, dynamicResponse, groupResponse, manualResponse, referenceResponse] = await Promise.all([fetch("/api/membership/reports"), fetch("/api/membership/custom-fields?active=1"), fetch("/api/membership/dynamic-lists"), fetch("/api/membership/volunteer-groups"), fetch("/api/membership/manual-lists"), fetch("/api/membership/reference")]);
    const value = await response.json();
    const fieldsValue = await fieldsResponse.json();
    const dynamicValue = await dynamicResponse.json();
    const groupValue = await groupResponse.json();
    const manualValue = await manualResponse.json();
    const referenceValue = await referenceResponse.json();
    if (!response.ok) { setError(value.error ?? "Unable to load reports."); return; }
    if (!fieldsResponse.ok) { setError(fieldsValue.error ?? "Unable to load custom fields."); return; }
    setCustomColumns((fieldsValue.fields ?? []).map((field: { id: string; name: string; appliesTo: string; type?: string; options?: unknown }) => ({ key: `custom:${field.id}`, label: `${field.appliesTo === "FAMILY" ? "Family" : "Member"}: ${field.name}`, type: field.type, options: Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === "string") : [] })));
    setReference({ types: referenceValue.types ?? [], roles: referenceValue.roles ?? [] });
    setVolunteerGroups((groupValue.groups ?? []).map((item: { id: string; name: string }) => ({ id: item.id, name: item.name })));
    setSources([
      ...(dynamicValue.lists ?? []).map((item: { id: string; name: string }) => ({ type: "dynamic-list" as const, id: item.id, name: `Dynamic list: ${item.name}` })),
      ...(groupValue.groups ?? []).map((item: { id: string; name: string }) => ({ type: "volunteer-group" as const, id: item.id, name: `Volunteer group: ${item.name}` })),
      ...(manualValue.lists ?? []).map((item: { id: string; name: string }) => ({ type: "manual-list" as const, id: item.id, name: `Manual list: ${item.name}` }))
    ]);
    setReports(value.reports ?? []);
  }
  useEffect(() => { void load(); }, []);

  function reset() {
    setEditing(null);
    setForm({ name: "", description: "", reportType: "custom", visibility: "PRIVATE", sourceType: "", sourceId: "", match: "all", conditions: [], columns: DEFAULT_MEMBERSHIP_REPORT_COLUMNS, sortKey: "birthMonthDay", sortDirection: "asc", groupingKey: "", groupingDirection: "asc" });
  }

  function edit(report: Report) {
    setEditing(report.id);
    const savedSort = report.sort?.[0];
    setForm({ name: report.name, description: report.description ?? "", reportType: report.reportType as MembershipReportType, visibility: report.visibility, sourceType: report.criteria?.sourceType ?? "", sourceId: report.criteria?.sourceId ?? "", match: report.criteria?.match ?? "all", conditions: report.criteria?.conditions ?? [], columns: report.columns?.length ? report.columns : DEFAULT_MEMBERSHIP_REPORT_COLUMNS, sortKey: savedSort?.key ?? "birthMonthDay", sortDirection: savedSort?.direction ?? "asc", groupingKey: report.grouping?.key ?? "", groupingDirection: report.grouping?.direction ?? "asc" });
    setMessage("");
  }

  function addCondition() {
    setForm((current) => ({ ...current, conditions: [...current.conditions, { field: "status", operator: "equals", value: "ACTIVE" }] }));
  }

  function selectReportType(reportType: MembershipReportType) {
    const preset = reportPreset(reportType);
    setForm((current) => ({ ...current, reportType, columns: preset.columns, conditions: preset.conditions, sortKey: preset.sortKey, sortDirection: preset.sortDirection, groupingKey: preset.groupingKey, groupingDirection: "asc" }));
  }

  function optionsForField(field: string) {
    if (field === "status") return [["ACTIVE", "Active"], ["INACTIVE", "Inactive"], ["REMOVED", "Removed"]];
    if (field === "emailConsent" || field === "smsConsent" || field === "weddingDate" || field === "deceasedDate") return [["true", "Yes"], ["false", "No"]];
    if (field === "birthdayMonth" || field === "weddingMonth") return Array.from({ length: 12 }, (_, index) => { const value = String(index + 1).padStart(2, "0"); return [value, value]; });
    if (field === "memberType") return reference.types.map((item) => [item.id, item.name]);
    if (field === "familyRole") return reference.roles.map((item) => [item.id, item.name]);
    if (field === "volunteerGroup") return volunteerGroups.map((item) => [item.id, item.name]);
    const customField = customColumns.find((column) => column.key === field);
    if (customField?.options?.length) return customField.options.map((option) => [option, option]);
    return [];
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(""); setError("");
    const response = await fetch(editing ? `/api/membership/reports/${editing}` : "/api/membership/reports", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, description: form.description, reportType: form.reportType, visibility: form.visibility, criteria: { conditions: form.conditions, match: form.match, sourceType: form.sourceType || undefined, sourceId: form.sourceId || undefined }, columns: form.columns, sort: [{ key: form.sortKey, direction: form.sortDirection }], grouping: form.groupingKey ? { key: form.groupingKey, direction: form.groupingDirection } : {} }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to save report."); return; }
    setMessage(editing ? "Report updated." : "Report saved.");
    reset();
    await load();
    window.dispatchEvent(new CustomEvent("membership-reports-updated", { detail: { id: value.report?.id } }));
  }

  function runOnce() {
    setMessage("");
    setError("");
    window.dispatchEvent(new CustomEvent("membership-report-preview", {
      detail: {
        name: form.name.trim() || "One-time report",
        reportType: form.reportType,
        criteria: { conditions: form.conditions, match: form.match, sourceType: form.sourceType || undefined, sourceId: form.sourceId || undefined },
        columns: form.columns,
        sort: [{ key: form.sortKey, direction: form.sortDirection }],
        grouping: form.groupingKey ? { key: form.groupingKey, direction: form.groupingDirection } : {}
      }
    }));
  }

  async function remove(report: Report) {
    if (!window.confirm(`Delete the "${report.name}" report?`)) return;
    const response = await fetch(`/api/membership/reports/${report.id}`, { method: "DELETE" });
    if (!response.ok) { setError("Unable to delete report."); return; }
    setMessage("Report deleted.");
    await load();
    window.dispatchEvent(new CustomEvent("membership-reports-updated"));
  }

  async function duplicate(report: Report) {
    setError("");
    const response = await fetch("/api/membership/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${report.name} (Copy)`.slice(0, 120),
        description: report.description ?? "",
        reportType: report.reportType,
        visibility: "PRIVATE",
        criteria: report.criteria,
        columns: report.columns,
        sort: report.sort ?? [],
        grouping: report.grouping ?? {},
        layout: {},
      })
    });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to duplicate report."); return; }
    setMessage("Report duplicated. You can edit the copy below.");
    await load();
    edit(value.report);
    window.dispatchEvent(new CustomEvent("membership-reports-updated", { detail: { id: value.report?.id } }));
  }

  const availableColumns = [...DEFAULT_MEMBERSHIP_REPORT_COLUMNS, ...customColumns];
  return <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-2xl">{editing ? "Edit report" : "Create a report"}</h2><p className="mt-1 text-sm text-ink/60">Save reusable filters, columns, sorting, and presentation preferences.</p></div>{editing && <Button type="button" variant="default" onClick={reset}>Cancel</Button>}</div>
      <form onSubmit={(event) => void save(event)} className="mt-5 grid gap-4">
        <label className="grid gap-1 text-sm font-semibold">Report name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="e.g. Active families missing email" /></label>
        <label className="grid gap-1 text-sm font-semibold">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="focus-ring min-h-20 rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Report type<select value={form.reportType} onChange={(event) => selectReportType(event.target.value as MembershipReportType)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">{MEMBERSHIP_REPORT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><span className="text-xs font-normal text-ink/55">Choosing a type applies a starting template for columns, filters, sorting, and grouping.</span></label><label className="grid gap-1 text-sm font-semibold">Visibility<select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="PRIVATE">Only me</option><option value="MEMBERSHIP_MANAGERS">Membership managers</option></select></label></div>
        <div className="rounded-xl border border-ink/10 p-4"><label className="grid gap-1 text-sm font-semibold">Audience source<select value={form.sourceType && form.sourceId ? `${form.sourceType}:${form.sourceId}` : ""} onChange={(event) => { const [type, id] = event.target.value.split(":"); setForm({ ...form, sourceType: (type ?? "") as SourceType, sourceId: id ?? "" }); }} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">All members matching filters</option>{sources.map((source) => <option key={`${source.type}:${source.id}`} value={`${source.type}:${source.id}`}>{source.name}</option>)}</select><span className="text-xs font-normal text-ink/55">Use a saved list or group as the report’s starting audience.</span></label></div>
        <div className="rounded-xl border border-ink/10 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Filters</h3><p className="text-xs text-ink/55">Choose from the available values when a field has a defined set of options.</p></div><div className="flex items-center gap-2"><select value={form.match} onChange={(event) => setForm({ ...form, match: event.target.value as "all" | "any" })} className="focus-ring rounded-lg border border-ink/15 px-2 py-1 text-sm"><option value="all">Match all</option><option value="any">Match any</option></select><button type="button" onClick={addCondition} className="focus-ring rounded-full border border-coral px-3 py-1 text-sm font-semibold text-coral">Add filter</button></div></div><div className="mt-3 grid gap-2">{form.conditions.map((condition, index) => { const valueOptions = optionsForField(condition.field); return <div key={`${condition.field}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"><select value={condition.field} onChange={(event) => setForm({ ...form, conditions: form.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value, value: "" } : item) })} className="focus-ring rounded-lg border border-ink/15 px-2 py-2 text-sm">{fields.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{customColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select><select value={condition.operator} onChange={(event) => setForm({ ...form, conditions: form.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value } : item) })} className="focus-ring rounded-lg border border-ink/15 px-2 py-2 text-sm">{operators.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{valueOptions.length ? <select value={condition.value} onChange={(event) => setForm({ ...form, conditions: form.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} className="focus-ring rounded-lg border border-ink/15 px-2 py-2 text-sm"><option value="">Choose a value</option>{valueOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <input value={condition.value} onChange={(event) => setForm({ ...form, conditions: form.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} className="focus-ring rounded-lg border border-ink/15 px-2 py-2 text-sm" placeholder="Value" />}<button type="button" onClick={() => setForm({ ...form, conditions: form.conditions.filter((_, itemIndex) => itemIndex !== index) })} className="focus-ring rounded-lg px-2 text-sm font-semibold text-coral">Remove</button></div>; })}</div></div>
        <fieldset className="rounded-xl border border-ink/10 p-4"><legend className="px-1 text-sm font-semibold">Columns</legend><div className="grid gap-2 sm:grid-cols-2">{availableColumns.map((column) => <label key={column.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.columns.some((item) => item.key === column.key)} onChange={(event) => setForm({ ...form, columns: event.target.checked ? [...form.columns, column] : form.columns.filter((item) => item.key !== column.key) })} />{column.label}</label>)}</div></fieldset>
        <div className="grid gap-4 rounded-xl border border-ink/10 p-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Default sort<select value={form.sortKey} onChange={(event) => setForm({ ...form, sortKey: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal">{DEFAULT_MEMBERSHIP_REPORT_COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Direction<select value={form.sortDirection} onChange={(event) => setForm({ ...form, sortDirection: event.target.value as "asc" | "desc" })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></div>
        <div className="grid gap-4 rounded-xl border border-ink/10 p-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Group results by<select value={form.groupingKey} onChange={(event) => setForm({ ...form, groupingKey: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">No grouping</option>{availableColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Group order<select value={form.groupingDirection} onChange={(event) => setForm({ ...form, groupingDirection: event.target.value as "asc" | "desc" })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></div>
        <div className="flex flex-wrap gap-2"><Button type="submit">{editing ? "Update report" : "Save report"}</Button><Button type="button" variant="default" onClick={runOnce}>Run now</Button></div>
        {message && <Notification variant="success">{message}</Notification>}{error && <Notification variant="danger">{error}</Notification>}
      </form>
    </section>
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-2xl">Saved reports</h2><div className="flex flex-wrap gap-2"><a href="/api/membership/reports/export" className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm font-semibold">Export definitions</a><label className="focus-ring cursor-pointer rounded-full border border-ink/20 px-3 py-2 text-sm font-semibold">Import definitions<input type="file" accept="application/json,.json" onChange={(event) => void importReports(event)} className="sr-only" /></label></div></div><div className="mt-5 grid gap-3">{reports.map((report) => <div key={report.id} className="rounded-xl border border-ink/10 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{report.name}</h3><p className="mt-1 text-xs text-ink/55">{MEMBERSHIP_REPORT_TYPES.find((type) => type.value === report.reportType)?.label ?? report.reportType} · {report.visibility === "PRIVATE" ? "Private" : "Membership managers"}</p></div></div>{report.description && <p className="mt-2 text-sm text-ink/65">{report.description}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("membership-report-run", { detail: { id: report.id } }))} className="focus-ring rounded-full bg-coral px-3 py-2 text-sm font-semibold text-white">Run</button><button type="button" onClick={() => window.location.assign(`/admin/report-automations?reportId=${encodeURIComponent(report.id)}`)} className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral">Automate</button><button type="button" onClick={() => edit(report)} className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm font-semibold">Edit</button><button type="button" onClick={() => void duplicate(report)} className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral">Duplicate</button><button type="button" onClick={() => void remove(report)} className="focus-ring rounded px-2 py-1 text-sm font-semibold text-coral">Delete</button></div></div>)}{!reports.length && <p className="text-sm text-ink/60">No saved reports yet.</p>}</div></section>
  </div>;
}
