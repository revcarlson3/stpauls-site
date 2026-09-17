"use client";

import { useState } from "react";

export function PrayerRequestForm({ name }: { name: string }) {
  const [request, setRequest] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [includeInSundayPrayers, setIncludeInSundayPrayers] = useState(true);
  const [requestPastoralContact, setRequestPastoralContact] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/membership/prayer-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request, durationDays: Number(durationDays), includeInSundayPrayers, requestPastoralContact }) });
    const value = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Thank you. Your request is awaiting approval." : value.error ?? "Unable to submit request.");
    if (response.ok) setRequest("");
    setBusy(false);
  }
  return <form onSubmit={(event) => void submit(event)} className="grid gap-4">
    <label className="grid gap-1 text-sm font-semibold">Your name<input readOnly value={name} className="rounded-lg border border-ink/15 bg-mist px-3 py-2 font-normal" /></label>
    <label className="grid gap-1 text-sm font-semibold">Prayer request<textarea required maxLength={500} value={request} onChange={(event) => setRequest(event.target.value)} rows={6} className="rounded-lg border border-ink/15 px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/55">{request.length}/500</span></label>
    <label className="grid gap-1 text-sm font-semibold">Keep active for<select value={durationDays} onChange={(event) => setDurationDays(event.target.value)} className="rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="7">One week</option><option value="30">One month</option><option value="90">Three months</option><option value="365">One year</option></select></label>
    <fieldset className="grid gap-2 text-sm"><legend className="font-semibold">Include this request in Sunday morning prayers?</legend><label><input type="radio" checked={includeInSundayPrayers} onChange={() => setIncludeInSundayPrayers(true)} /> Yes</label><label><input type="radio" checked={!includeInSundayPrayers} onChange={() => setIncludeInSundayPrayers(false)} /> No</label></fieldset>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={requestPastoralContact} onChange={(event) => setRequestPastoralContact(event.target.checked)} /> Please ask a pastor or elder to contact me.</label>
    <button disabled={busy} className="rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit for approval"}</button>
    {message && <p role="status" className="text-sm text-ink/70">{message}</p>}
  </form>;
}
