"use client";

import { useEffect, useState } from "react";
import { Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

type Operations = {
  sites: { total: number; byLifecycle: Record<string, number> };
  onboarding: { total: number; byStatus: Record<string, number> };
  users: { total: number };
  support: { open: number };
  announcements: { active: number };
  domains: { total: number; verified: number; unverified: number; byStatus: Record<string, number>; byTlsStatus: Record<string, number> };
  recentAuditActivity: Array<{ id: string; activityType: string; summary: string; createdAt: string; actor: string }>;
};

export default function GlobalAdminOperations() {
  const [operations, setOperations] = useState<Operations | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/global-admin/operations", { cache: "no-store" })
      .then(async (response) => {
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(value.error ?? "Unable to load platform operations.");
        setOperations(value);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load platform operations."));
  }, []);

  return (
    <main className="min-h-screen bg-sand py-10 sm:py-14">
      <Container>
        <div className="flex justify-end"><GlobalAdminBackLink /></div>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Platform operations</p>
        <h1 className="mt-2 font-serif text-4xl">Operations dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">A platform-wide view of tenant lifecycle, onboarding, support, domains, communications, and administrative activity.</p>
        {error && <Notification variant="danger" className="mt-6">{error}</Notification>}
        {!operations && !error && <Card className="mt-8 p-8"><p className="text-sm text-ink/60">Loading platform operations...</p></Card>}
        {operations && <div className="mt-8 grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total sites" value={operations.sites.total} />
            <Metric label="Total users" value={operations.users.total} />
            <Metric label="Open support tickets" value={operations.support.open} />
            <Metric label="Active announcements" value={operations.announcements.active} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <BreakdownCard title="Sites by lifecycle" values={operations.sites.byLifecycle} empty="No sites have been provisioned." />
            <BreakdownCard title="Onboarding status" values={operations.onboarding.byStatus} empty="No onboarding records are available." />
            <Card className="p-6 sm:p-8"><h2 className="font-serif text-2xl">Domain health</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Configured" value={operations.domains.total} /><Metric label="Verified" value={operations.domains.verified} /><Metric label="Unverified" value={operations.domains.unverified} /></div><div className="mt-5 grid gap-2 text-sm">{Object.entries(operations.domains.byStatus).map(([status, count]) => <p key={status} className="flex justify-between rounded-lg border border-ink/10 px-3 py-2"><span>{formatLabel(status)}</span><strong>{count}</strong></p>)}{!Object.keys(operations.domains.byStatus).length && <p className="text-ink/60">No domain status data is available.</p>}</div><p className="mt-4 text-xs uppercase tracking-wide text-ink/45">TLS reporting</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(operations.domains.byTlsStatus).map(([status, count]) => <span key={status} className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">{formatLabel(status)}: {count}</span>)}{!Object.keys(operations.domains.byTlsStatus).length && <span className="text-sm text-ink/60">No TLS data is available.</span>}</div></Card>
            <Card className="p-6 sm:p-8"><h2 className="font-serif text-2xl">Recent global-admin activity</h2>{operations.recentAuditActivity.length ? <div className="mt-4 grid gap-3">{operations.recentAuditActivity.map((entry) => <div key={entry.id} className="rounded-lg border border-ink/10 px-4 py-3"><p className="text-sm font-semibold">{entry.summary}</p><p className="mt-1 text-xs text-ink/55">{entry.actor} · {new Date(entry.createdAt).toLocaleString()} · {formatLabel(entry.activityType)}</p></div>)}</div> : <p className="mt-3 text-sm text-ink/60">No global-admin audit activity is recorded.</p>}</Card>
          </div>
        </div>}
      </Container>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-mist/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{label}</p><p className="mt-2 text-2xl font-semibold text-ink">{value}</p></div>;
}

function BreakdownCard({ title, values, empty }: { title: string; values: Record<string, number>; empty: string }) {
  return <Card className="p-6 sm:p-8"><h2 className="font-serif text-2xl">{title}</h2><div className="mt-4 grid gap-2">{Object.entries(values).map(([status, count]) => <p key={status} className="flex justify-between rounded-lg border border-ink/10 px-3 py-2 text-sm"><span>{formatLabel(status)}</span><strong>{count}</strong></p>)}{!Object.keys(values).length && <p className="text-sm text-ink/60">{empty}</p>}</div></Card>;
}

function formatLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
