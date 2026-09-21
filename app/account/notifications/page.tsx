"use client";

import { useEffect, useState } from "react";

type Notification = { id: string; title: string; message: string; link: string | null; category: string; readAt: string | null; createdAt: string; sender?: { name: string; email: string } | null };

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  async function load(before?: string | null) {
    const response = await fetch(`/api/notifications${before ? `?before=${encodeURIComponent(before)}` : ""}`);
    const value = response.ok ? await response.json() : { notifications: [] };
    setItems((current) => before ? [...current, ...(value.notifications ?? [])] : (value.notifications ?? []));
    setNextBefore(value.nextBefore ?? null);
    setHasMore(value.hasMore === true);
  }
  useEffect(() => { void load(); }, []);
  async function markRead(item: Notification) {
    if (!item.readAt) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
    }
  }
  async function clearUnread() { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearUnread: true }) }); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); }
  async function remove(id: string) { await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); setItems((current) => current.filter((item) => item.id !== id)); }
  async function removeAll() { await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); setItems([]); }
  const visibleItems = filter === "UNREAD" ? items.filter((item) => !item.readAt) : items;
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-10"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Account</p><h1 className="mt-2 font-serif text-4xl">Notifications</h1><div className="mt-4 flex flex-wrap gap-2"><button type="button" className={`rounded-full border px-3 py-1.5 text-sm ${filter === "ALL" ? "border-coral bg-coral text-white" : ""}`} onClick={() => setFilter("ALL")}>All</button><button type="button" className={`rounded-full border px-3 py-1.5 text-sm ${filter === "UNREAD" ? "border-coral bg-coral text-white" : ""}`} onClick={() => setFilter("UNREAD")}>Unread</button><button type="button" className="rounded-full border px-3 py-1.5 text-sm" onClick={() => void clearUnread()}>Clear unread</button><button type="button" className="rounded-full border border-red-300 px-3 py-1.5 text-sm text-red-700" onClick={() => void removeAll()}>Delete all</button></div></div><section className="space-y-3">{visibleItems.length ? visibleItems.map((item) => <article key={item.id} className={`rounded-2xl border p-5 ${item.readAt ? "border-ink/10 bg-white" : "border-coral/40 bg-coral/5"}`}><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="font-semibold">{item.title}</h2><span className="text-[10px] font-bold uppercase tracking-wide text-coral">{item.category}</span></div><p className="mt-1 text-sm text-ink/70">{item.message}</p><p className="mt-1 text-xs text-ink/50">{item.sender?.name ? `From ${item.sender.name} · ` : ""}{new Date(item.createdAt).toLocaleString()}</p></div><time className="text-xs text-ink/50">{item.readAt ? "Read" : "New"}</time></div><div className="mt-3 flex gap-3">{!item.readAt && <button type="button" className="text-sm font-semibold text-coral hover:underline" onClick={() => void markRead(item)}>Mark read</button>}{item.link && <a className="text-sm font-semibold text-coral hover:underline" href={item.link} onClick={() => void markRead(item)}>Open notification</a>}<button type="button" className="text-sm font-semibold text-ink/50 hover:text-coral" onClick={() => void remove(item.id)}>Delete</button></div></article>) : <p className="rounded-xl border border-ink/10 bg-white p-5 text-sm text-ink/60">No notifications match this filter.</p>}{hasMore && <button type="button" className="w-full rounded-xl border px-4 py-3 text-sm font-semibold" onClick={() => void load(nextBefore)}>Load older notifications</button>}</section></main>;
}
