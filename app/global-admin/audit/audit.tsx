"use client";

import { useEffect, useState } from "react";
import { Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

type AuditItem = {
  id: string; activityType: string; summary: string; details: string | null; createdAt: string;
  actor: { name: string; email: string } | null; site: { name: string; slug: string } | null;
  target: { type: string | null; id: string | null } | null;
};
type AuditResponse = { items: AuditItem[]; activityTypes: string[]; sites: Array<{ id: string; name: string; slug: string }>; pagination: { page: number; pageCount: number; total: number } };

export default function GlobalAdminAuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ search: "", actor: "", activityType: "", churchId: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const load = async (nextPage = page) => {
    setBusy(true); setError("");
    const params = new URLSearchParams({ page: String(nextPage), pageSize: "25" });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    try {
      const response = await fetch(`/api/global-admin/audit?${params}`, { cache: "no-store" });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error ?? "Unable to load audit activity.");
      setData(value); setPage(nextPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load audit activity.");
    } finally { setBusy(false); }
  };
  useEffect(() => { void load(1); }, []);
  return   <main className="min-h-screen bg-sand py-10 sm:py-14"><Container><div className="flex justify-end"><GlobalAdminBackLink /></div><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Governance</p><h1 className="mt-2 font-serif text-4xl">Audit and Governance Center</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Review platform-wide administrative activity without exposing sensitive payloads.</p>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}<Card className="mt-8 p-5 sm:p-6"><form className="grid gap-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); void load(1); }}><label className="grid gap-1 text-sm font-semibold">Search<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Summary, target, details" /></label><label className="grid gap-1 text-sm font-semibold">Actor<input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={filters.actor} onChange={(event) => setFilters({ ...filters, actor: event.target.value })} placeholder="Name or email" /></label><label className="grid gap-1 text-sm font-semibold">Site / tenant<select className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" value={filters.churchId} onChange={(event) => setFilters({ ...filters, churchId: event.target.value })}><option value="">All sites</option>{data?.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Activity type<select className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" value={filters.activityType} onChange={(event) => setFilters({ ...filters, activityType: event.target.value })}><option value="">All activity</option>{data?.activityTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">From<input type="date" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">To<input type="date" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label><button type="submit" disabled={busy} className="focus-ring self-end rounded-lg bg-ink px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Loading..." : "Apply filters"}</button></form></Card>{!data && !error && <Card className="mt-6 p-8 text-sm text-ink/60">Loading audit activity...</Card>}{data && <section className="mt-6 grid gap-3">{data.items.map((item) => <Card key={item.id} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{item.summary}</p><p className="mt-1 text-xs text-ink/55">{item.activityType} · {item.actor?.name ?? "System"} · {item.site?.name ?? "Platform-wide"} · {new Date(item.createdAt).toLocaleString()}</p></div>{item.target && <span className="rounded-full bg-mist px-3 py-1 text-xs">{item.target.type ?? "Target"}: {item.target.id ?? "n/a"}</span>}</div>{item.details && <p className="mt-3 whitespace-pre-wrap text-sm text-ink/70">{item.details}</p>}</Card>)}{!data.items.length && <Card className="p-8 text-sm text-ink/60">No audit activity matches these filters.</Card>}<div className="flex items-center justify-between text-sm"><span>{data.pagination.total} entr{data.pagination.total === 1 ? "y" : "ies"}</span><div className="flex gap-2"><button type="button" disabled={busy || page <= 1} onClick={() => void load(page - 1)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={busy || page >= data.pagination.pageCount} onClick={() => void load(page + 1)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 disabled:opacity-40">Next</button></div></div></section>}</Container></main>;
}
