"use client";
import { useState } from "react";

type Item = { id: string; submitterName: string; request: string; expiresAt: string; includeInSundayPrayers: boolean; requestPastoralContact: boolean; status: string; createdAt: string };
export function PrayerRequestReview({ requests }: { requests: Item[] }) {
  const [items, setItems] = useState(requests);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ request: "", expiresAt: "", includeInSundayPrayers: false, requestPastoralContact: false });
  async function review(id: string, status: "APPROVED" | "DECLINED") {
    const response = await fetch("/api/membership/prayer-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (response.ok) setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }
  async function saveEdit(id: string) {
    const response = await fetch("/api/membership/prayer-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "edit", ...draft }) });
    if (response.ok) {
      const value = await response.json();
      setItems((current) => current.map((item) => item.id === id ? { ...item, ...value.request, expiresAt: value.request.expiresAt } : item));
      setEditing(null);
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this prayer request permanently?")) return;
    const response = await fetch("/api/membership/prayer-requests", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) setItems((current) => current.filter((item) => item.id !== id));
  }
  return <div className="grid gap-5">{items.length ? items.map((item) => <article key={item.id} className="rounded-xl border border-ink/10 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.submitterName}</strong><span className="text-xs text-ink/55">{item.status} · expires {new Date(item.expiresAt).toLocaleDateString()}</span></div>{editing === item.id ? <div className="mt-3 grid gap-3"><textarea maxLength={500} value={draft.request} onChange={(event) => setDraft({ ...draft, request: event.target.value })} rows={5} className="rounded-lg border border-ink/15 px-3 py-2" /><label className="grid gap-1 text-sm font-semibold">Expires<input type="date" value={draft.expiresAt} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} className="rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.includeInSundayPrayers} onChange={(event) => setDraft({ ...draft, includeInSundayPrayers: event.target.checked })} /> Sunday morning prayers</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.requestPastoralContact} onChange={(event) => setDraft({ ...draft, requestPastoralContact: event.target.checked })} /> Pastor or elder contact</label><div className="flex gap-2"><button onClick={() => void saveEdit(item.id)} className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Save</button><button onClick={() => setEditing(null)} className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Cancel</button></div></div> : <><p className="mt-3 whitespace-pre-wrap">{item.request}</p><p className="mt-2 text-xs text-ink/55">{item.includeInSundayPrayers ? "Sunday prayers requested." : "Not for Sunday prayers."} {item.requestPastoralContact ? "Pastoral contact requested." : ""}</p><div className="mt-4 flex flex-wrap gap-2">{item.status === "PENDING" && <><button onClick={() => void review(item.id, "APPROVED")} className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Approve</button><button onClick={() => void review(item.id, "DECLINED")} className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Decline</button></>}<button onClick={() => { setEditing(item.id); setDraft({ request: item.request, expiresAt: item.expiresAt.slice(0, 10), includeInSundayPrayers: item.includeInSundayPrayers, requestPastoralContact: item.requestPastoralContact }); }} className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Edit</button><button onClick={() => void remove(item.id)} className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">Delete</button></div></>}</article>) : <p className="text-sm text-ink/60">No requests yet.</p>}</div>;
}
