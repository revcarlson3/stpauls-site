"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Container } from "@/components/ui";

type Church = { id: string; name: string; slug: string };
type Overview = {
  site: { name: string; slug: string; location: string | null; status: string; createdAt: string };
  lifecycle: { status: string; onboardingStatus: string; currentStep: string | null };
  health: {
    activeUsers: number;
    domains: { total: number; active: number; pending: number; failed: number };
    openSupportTickets: number;
    subscription: { status: string; interval: string; currentPeriodEnd: string | null } | null;
    activeAnnouncements: number;
  };
  setup: { siteIdentity: boolean; modules: boolean; security: boolean };
};

const areas = [
  { title: "Site overview", description: "Health, lifecycle, domains, and onboarding readiness.", status: "Available", href: "#site-overview" },
  { title: "Site identity and modules", description: "Manage branding, domains, and enabled product areas.", status: "Coming next" },
  { title: "Users and security", description: "Review access, roles, MFA, and security posture.", status: "Coming next" },
  { title: "Billing and promotions", description: "Inspect subscription status, plans, and promotions.", status: "Coming next" },
  { title: "Support", description: "Track tenant support requests and escalations.", status: "Coming next" },
  { title: "Announcements", description: "Review announcements delivered to this site.", status: "Coming next" },
  { title: "Audited actions and View As", description: "Open privileged tools with recent reauthentication.", status: "Coming next" }
];

export default function GlobalAdminControlPlane() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([fetch("/api/global-admin/churches"), fetch("/api/global-admin/context")]).then(async ([churchesResponse, contextResponse]) => {
      if (churchesResponse.ok) setChurches(await churchesResponse.json());
      if (!contextResponse.ok) return;
      const context = await contextResponse.json();
      setSelectedChurchId(context.church?.id ?? "");
    }).catch(() => setError("Unable to load available sites."));
  }, []);
  useEffect(() => {
    if (!selectedChurchId) {
      setOverview(null);
      return;
    }
    void fetch("/api/global-admin/overview", { cache: "no-store" }).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load site overview.");
      setOverview(value);
      setError("");
    }).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load site overview."));
  }, [selectedChurchId]);
  async function selectChurch(churchId: string) {
    setError("");
    const response = await fetch("/api/global-admin/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ churchId }) });
    if (response.ok) {
      setSelectedChurchId(churchId);
      return;
    }
    const value = await response.json().catch(() => ({}));
    setError(value.error ?? "Unable to select site.");
  }
  return <main className="min-h-screen bg-sand py-10 sm:py-14">
    <Container>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Bridge administration</p><h1 className="mt-3 font-serif text-4xl">Control plane</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Select a site context before opening tenant-scoped tools. Every action remains bounded to the selected site.</p></div>
        <label className="grid min-w-64 gap-2 text-sm font-semibold">Selected site<select value={selectedChurchId} onChange={(event) => void selectChurch(event.target.value)} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2"><option value="">Select a site</option>{churches.map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}</select></label>
      </div>
      {error && <p role="alert" className="mt-6 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">{error}</p>}
      {!selectedChurchId && <Card className="mt-8 p-8"><h2 className="font-serif text-2xl">Choose a site to begin</h2><p className="mt-2 text-sm text-ink/60">The dashboard will show lifecycle and health details without exposing internal tenant identifiers.</p></Card>}
      {overview && <div id="site-overview" className="mt-8 grid gap-6">
        <Card className="p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Selected site</p><h2 className="mt-2 font-serif text-3xl">{overview.site.name}</h2><p className="mt-1 text-sm text-ink/60">{overview.site.location ?? overview.site.slug}</p></div><span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink/70">{overview.site.status}</span></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Lifecycle" value={overview.lifecycle.status} /><Summary label="Active users" value={String(overview.health.activeUsers)} /><Summary label="Open support" value={String(overview.health.openSupportTickets)} /><Summary label="Subscription" value={overview.health.subscription?.status ?? "Not active"} /></div></Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{areas.map((area) => area.href ? <Link key={area.title} href={area.href} className="focus-ring"><AreaCard area={area} /></Link> : <AreaCard key={area.title} area={area} />)}</div>
      </div>}
    </Container>
  </main>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-mist/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{label}</p><p className="mt-2 text-lg font-semibold text-ink">{value}</p></div>;
}

function AreaCard({ area }: { area: typeof areas[number] }) {
  return <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-coral/40"><div className="flex items-start justify-between gap-3"><h3 className="font-serif text-xl">{area.title}</h3><span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide ${area.status === "Available" ? "bg-coral/10 text-coral" : "bg-ink/5 text-ink/50"}`}>{area.status}</span></div><p className="mt-3 text-sm leading-6 text-ink/60">{area.description}</p></Card>;
}
