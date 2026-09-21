"use client";

import { useCallback, useEffect, useState } from "react";

type Automation = { id: string; name: string; enabled: boolean; inAppEnabled?: boolean; timezone?: string; lastRunAt?: string | null; nextRunAt?: string | null; failureCount?: number; scheduleKind: string; schedule?: { hour?: number; minute?: number; dayOfWeek?: number }; criteria?: { eventSelection?: string }; subject: string; format: string; recipients: string[]; report: { id: string; name: string; scope: string } };
type AutomationRun = { id: string; status: string; error?: string | null; createdAt: string; startedAt?: string | null; completedAt?: string | null; attemptCount?: number; rowCount?: number | null; providerId?: string | null; durationMs?: number | null; isRetry?: boolean };

export default function ReportAutomationsPage() {
  const [items, setItems] = useState<Automation[]>([]);
  const [history, setHistory] = useState<Record<string, AutomationRun[]>>({});
  const [reports, setReports] = useState<Array<{ id: string; name: string; scope: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [form, setForm] = useState({ name: "", reportId: "", recipients: [] as string[], subject: "", scheduleKind: "MANUAL", format: "CSV", hour: "8", minute: "0", dayOfWeek: "1", timezone: "America/Chicago", eventSelection: "ALL", inAppEnabled: false });
  const load = useCallback(async () => {
    const response = await fetch("/api/report-automations");
    if (response.ok) setItems((await response.json()).automations);
    const [membership, events, recipients] = await Promise.all([fetch("/api/membership/reports"), fetch("/api/events/reports"), fetch("/api/report-automations/recipients")]);
    const values = [...(membership.ok ? (await membership.json()).reports : []), ...(events.ok ? (await events.json()).reports : [])];
    setReports(values);
    if (recipients.ok) setUsers((await recipients.json()).users ?? []);
    const requestedReportId = new URLSearchParams(window.location.search).get("reportId");
    if (requestedReportId && values.some((report) => report.id === requestedReportId)) {
      setForm((current) => ({ ...current, reportId: requestedReportId }));
    } else if (!form.reportId && values[0]) {
      setForm((current) => ({ ...current, reportId: values[0].id }));
    }
  }, [form.reportId]);
  useEffect(() => { void load(); }, [load]);
  function payload() {
    return { name: form.name, reportId: form.reportId, recipients: form.recipients, subject: form.subject, scheduleKind: form.scheduleKind, format: form.format, enabled: form.scheduleKind !== "MANUAL", inAppEnabled: form.inAppEnabled, timezone: form.timezone, schedule: { hour: Number(form.hour), minute: Number(form.minute), dayOfWeek: Number(form.dayOfWeek) }, criteria: { eventSelection: form.eventSelection } };
  }
  async function save() {
    setError("");
    if (!form.name.trim() || !form.reportId || !form.subject.trim() || !form.recipients.length) {
      setError("Name, saved report, subject, and at least one recipient are required.");
      return;
    }
    const response = await fetch(editingId ? `/api/report-automations/${editingId}` : "/api/report-automations", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(value.error ?? "Unable to save the automation.");
      return;
    }
    setEditingId(null);
    setForm((current) => ({ ...current, name: "", recipients: [], subject: "" }));
    await load();
  }
  async function run(id: string, test = false) {
    setBusyAction(`${test ? "test" : "run"}:${id}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/report-automations/${id}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test }) });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error ?? "The automation failed to run.");
      const status = value.run?.status;
      setNotice(status === "FAILED" ? { type: "error", message: `Automation failed: ${value.run?.error ?? "the report could not be delivered."}` } : { type: "success", message: test ? "Test delivery succeeded and was sent only to your account." : "Automation ran successfully and the report was delivered." });
      await load();
      await showHistory(id);
    } catch (runError) {
      setNotice({ type: "error", message: runError instanceof Error ? runError.message : "The automation failed to run." });
    } finally {
      setBusyAction(null);
    }
  }
  async function toggle(item: Automation) {
    setBusyAction(`toggle:${item.id}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/report-automations/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name, reportId: item.report.id, recipients: item.recipients, subject: item.subject, format: item.format, enabled: !item.enabled, inAppEnabled: item.inAppEnabled, timezone: item.timezone || "America/Chicago", scheduleKind: item.scheduleKind, schedule: item.schedule, criteria: item.criteria }) });
      if (!response.ok) throw new Error("Unable to update the automation status.");
      await load();
    } catch (toggleError) {
      setNotice({ type: "error", message: toggleError instanceof Error ? toggleError.message : "Unable to update the automation status." });
    } finally {
      setBusyAction(null);
    }
  }
  function edit(item: Automation) { setBusyAction(`edit:${item.id}`); setEditingId(item.id); setForm({ name: item.name, reportId: item.report.id, recipients: item.recipients, subject: item.subject, scheduleKind: item.scheduleKind, format: item.format || "CSV", hour: String(item.schedule?.hour ?? 8), minute: String(item.schedule?.minute ?? 0), dayOfWeek: String(item.schedule?.dayOfWeek ?? 1), timezone: item.timezone || "America/Chicago", eventSelection: item.criteria?.eventSelection === "MOST_RECENT" ? "MOST_RECENT" : "ALL", inAppEnabled: item.inAppEnabled === true }); window.scrollTo({ top: 0, behavior: "smooth" }); window.setTimeout(() => setBusyAction(null), 350); }
  async function showHistory(id: string) { setBusyAction(`history:${id}`); try { const response = await fetch(`/api/report-automations/${id}/runs`); if (!response.ok) throw new Error("Unable to load run history."); const data = await response.json(); setHistory((current) => ({ ...current, [id]: data.runs })); } catch (historyError) { setNotice({ type: "error", message: historyError instanceof Error ? historyError.message : "Unable to load run history." }); } finally { setBusyAction(null); } }
  async function retry(id: string, runId: string) {
    setBusyAction(`retry:${runId}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/report-automations/${id}/runs/${runId}/retry`, { method: "POST" });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error ?? "Unable to retry the failed run.");
      setNotice(value.run?.status === "SUCCEEDED" ? { type: "success", message: "The failed run was retried successfully." } : { type: "error", message: `Retry failed: ${value.run?.error ?? "delivery did not complete."}` });
      await load();
      await showHistory(id);
    } catch (retryError) {
      setNotice({ type: "error", message: retryError instanceof Error ? retryError.message : "Unable to retry the failed run." });
    } finally {
      setBusyAction(null);
    }
  }
  async function remove(id: string) { await fetch(`/api/report-automations/${id}`, { method: "DELETE" }); await load(); }
  return <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
    <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Reports</p><h1 className="mt-2 font-serif text-4xl">Email automations</h1><p className="mt-3 text-ink/60">Durable scheduled delivery for saved Membership and Events reports. A deployment cron must call the protected process endpoint.</p>{notice && <p role="status" className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.message}</p>}</div>
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">{editingId ? "Edit automation" : "New automation"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="rounded border p-2" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <select className="rounded border p-2" value={form.reportId} onChange={(event) => setForm({ ...form, reportId: event.target.value })}>{reports.map((report) => <option key={report.id} value={report.id}>{report.scope}: {report.name}</option>)}</select>
        <label className="grid gap-1 text-sm font-semibold">Recipients<select multiple required size={Math.min(Math.max(users.length, 3), 6)} className="rounded border p-2 font-normal" value={form.recipients} onChange={(event) => setForm({ ...form, recipients: Array.from(event.target.selectedOptions, (option) => option.value) })}>{users.map((user) => <option key={user.id} value={user.email}>{user.name} ({user.email})</option>)}</select><span className="text-xs font-normal text-ink/55">Only active users with the Admin Access security group are listed. Hold Ctrl/Cmd to select multiple users.</span></label>
        <input className="h-10 self-start rounded border p-2" placeholder="Subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
        <select className="rounded border p-2" value={form.scheduleKind} onChange={(event) => setForm({ ...form, scheduleKind: event.target.value })}><option value="MANUAL">Manual only</option><option value="HOURLY">Hourly</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option></select>
        <label className="grid gap-1 text-sm font-semibold">Schedule timezone<select className="rounded border p-2 font-normal" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}><option value="America/Chicago">Central Time (US & Canada)</option><option value="America/New_York">Eastern Time (US & Canada)</option><option value="America/Denver">Mountain Time (US & Canada)</option><option value="America/Los_Angeles">Pacific Time (US & Canada)</option><option value="UTC">UTC</option></select></label>
        <select className="rounded border p-2" value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })}><option value="CSV">CSV attachment</option><option value="HTML">Printable HTML attachment</option><option value="PDF">PDF attachment</option></select>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Event data to include<select className="rounded border p-2 font-normal" value={form.eventSelection} onChange={(event) => setForm({ ...form, eventSelection: event.target.value })}><option value="ALL">All events matching the saved report</option><option value="MOST_RECENT">Most recent event only</option></select><span className="text-xs font-normal text-ink/55">Useful for recurring reports such as a weekly absentee report. Membership reports always use the saved report definition.</span></label>
        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={form.inAppEnabled} onChange={(event) => setForm({ ...form, inAppEnabled: event.target.checked })} />Also create an in-app notification for selected recipients</label>
        {form.scheduleKind !== "MANUAL" && <><label className="grid gap-1 text-sm font-semibold">Hour (0–23)<input type="number" min="0" max="23" className="rounded border p-2 font-normal" value={form.hour} onChange={(event) => setForm({ ...form, hour: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Minute (0–59)<input type="number" min="0" max="59" className="rounded border p-2 font-normal" value={form.minute} onChange={(event) => setForm({ ...form, minute: event.target.value })} /></label>{form.scheduleKind === "WEEKLY" && <label className="grid gap-1 text-sm font-semibold">Day<select className="rounded border p-2 font-normal" value={form.dayOfWeek} onChange={(event) => setForm({ ...form, dayOfWeek: event.target.value })}><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label>}</>}
      </div><div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" className="rounded-full bg-coral px-5 py-2 font-semibold text-white" onClick={() => void save()}>{editingId ? "Save changes" : "Create automation"}</button>{editingId && <button type="button" className="rounded-full border px-5 py-2 font-semibold" onClick={() => { setEditingId(null); setError(""); }}>Cancel</button>}{error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}</div>
    </section>
    <section className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-ink/10 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-semibold">{item.name}</h3><p className="text-sm text-ink/60">{item.report.scope}: {item.report.name} · {item.scheduleKind}{item.scheduleKind !== "MANUAL" ? ` at ${String(item.schedule?.hour ?? 8).padStart(2, "0")}:${String(item.schedule?.minute ?? 0).padStart(2, "0")} (${item.timezone || "America/Chicago"})` : ""} · {item.recipients.join(", ")}</p><p className="mt-1 text-xs text-ink/50">{item.lastRunAt ? `Last run: ${new Date(item.lastRunAt).toLocaleString()}` : "No runs yet"}{item.nextRunAt ? ` · Next run: ${new Date(item.nextRunAt).toLocaleString()}` : ""}{item.failureCount ? ` · ${item.failureCount} failed attempt(s)` : ""}</p></div><div className="flex flex-wrap gap-2"><button className={`rounded-full border px-3 py-1 text-sm transition-colors ${busyAction === `edit:${item.id}` || editingId === item.id ? "border-coral bg-coral text-white" : ""}`} onClick={() => edit(item)}>Edit</button><button className={`rounded-full border px-3 py-1 text-sm transition-colors ${busyAction === `toggle:${item.id}` ? "border-coral bg-coral text-white" : ""}`} onClick={() => void toggle(item)}>{busyAction === `toggle:${item.id}` ? "Updating…" : item.enabled ? "Disable" : "Enable"}</button><button title="Send now to the configured recipients" className={`rounded-full border px-3 py-1 text-sm transition-colors ${busyAction === `run:${item.id}` ? "border-coral bg-coral text-white" : ""}`} onClick={() => void run(item.id)} disabled={busyAction !== null}>{busyAction === `run:${item.id}` ? "Running…" : "Run Now"}</button><button title="Send a test only to your account" className={`rounded-full border px-3 py-1 text-sm transition-colors ${busyAction === `test:${item.id}` ? "border-coral bg-coral text-white" : ""}`} onClick={() => void run(item.id, true)} disabled={busyAction !== null}>{busyAction === `test:${item.id}` ? "Testing…" : "Test delivery"}</button><button className={`rounded-full border px-3 py-1 text-sm transition-colors ${busyAction === `history:${item.id}` ? "border-coral bg-coral text-white" : ""}`} onClick={() => void showHistory(item.id)}>{busyAction === `history:${item.id}` ? "Loading…" : "History"}</button><button className="rounded-full border border-red-300 px-3 py-1 text-sm text-red-700" onClick={() => void remove(item.id)}>Delete</button></div></div>{history[item.id] && <div className="mt-3 border-t pt-3 text-sm">{history[item.id].map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/5 py-2 last:border-b-0"><p><strong>{run.status}</strong> · {new Date(run.createdAt).toLocaleString()}{run.rowCount !== null && run.rowCount !== undefined ? ` · ${run.rowCount} row(s)` : ""}{run.attemptCount ? ` · attempt ${run.attemptCount}` : ""}{run.durationMs !== null && run.durationMs !== undefined ? ` · ${Math.max(1, Math.round(run.durationMs / 1000))}s` : ""}{run.providerId ? ` · provider ${run.providerId}` : ""}{run.error ? ` · ${run.error}` : ""}</p>{run.status === "FAILED" && <button className={`rounded-full border px-2 py-1 text-xs transition-colors ${busyAction === `retry:${run.id}` ? "border-coral bg-coral text-white" : ""}`} onClick={() => void retry(item.id, run.id)}>{busyAction === `retry:${run.id}` ? "Retrying…" : "Retry"}</button>}</div>)}</div>}</article>)}</section>
  </main>;
}
