"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Container } from "@/components/ui";

type Church = { id: string; name: string; slug: string; status: string; lifecycleStatus: string; onboardingStatus: string };
type Overview = { site: { name: string; slug: string; location: string | null; status: string }; lifecycle: { status: string; onboardingStatus: string; currentStep: string | null }; health: { users: number }; operational: { onboarding: { status: string; currentStep: string; completion: { siteIdentity: boolean; modules: boolean; security: boolean; completedAt: string | null } } | null; domains: Array<{ hostname: string; kind: string; status: string; tlsStatus: string | null; verification: { verified: boolean; verifiedAt: string | null; lastCheckedAt: string | null } }>; subscription: { status: string; provider: string; interval: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; plan: { name: string; slug: string; currency: string } | null } | null; support: { openCount: number; recentCount: number; recentTickets: Array<{ id: string; subject: string; status: string; priority: string; updatedAt: string }> }; announcements: { activeCount: number; recentCount: number; recent: Array<{ id: string; title: string; severity: string; publishedAt: string; acknowledgedAt: string | null }> } }; recentActions: Array<{ id: string; summary: string; createdAt: string; actor: string }> };
type Action = "enable" | "activate" | "suspend" | "disable";

const actions: Array<{ action: Action; label: string }> = [
  { action: "enable", label: "Enable" },
  { action: "activate", label: "Activate" },
  { action: "suspend", label: "Suspend" },
  { action: "disable", label: "Disable" }
];

export default function GlobalAdminControlPlane() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);

  async function loadOverview() {
    if (!selectedChurchId) { setOverview(null); return; }
    const response = await fetch("/api/global-admin/overview", { cache: "no-store" });
    const body = await response.text();
    const value = body ? JSON.parse(body) : {};
    if (!response.ok) throw new Error(value.error ?? "Unable to load site overview.");
    setOverview(value);
  }

  useEffect(() => {
    void Promise.all([fetch("/api/global-admin/churches"), fetch("/api/global-admin/context")]).then(async ([churchesResponse, contextResponse]) => {
      if (churchesResponse.ok) setChurches(await churchesResponse.json());
      if (contextResponse.ok) setSelectedChurchId((await contextResponse.json()).church?.id ?? "");
    }).catch(() => setError("Unable to load available sites."));
  }, []);
  useEffect(() => { void loadOverview().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load site overview.")); }, [selectedChurchId]);

  async function selectChurch(churchId: string) {
    setError("");
    const response = await fetch("/api/global-admin/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ churchId }) });
    if (response.ok) { setSelectedChurchId(churchId); return; }
    const value = await response.json().catch(() => ({}));
    setError(value.error ?? "Unable to select site.");
  }
  async function changeLifecycle(action: Action) {
    setBusy(action); setError("");
    const response = await fetch("/api/global-admin/lifecycle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const value = await response.json().catch(() => ({}));
    setBusy(null);
    if (response.status === 428) {
      window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin")}&reauth=1`;
      return;
    }
    if (!response.ok) { setError(value.error ?? "Unable to change site lifecycle."); return; }
    await loadOverview();
    setChurches((current) => current.map((church) => church.id === selectedChurchId ? { ...church, lifecycleStatus: value.church.lifecycleStatus, onboardingStatus: value.church.onboardingStatus, status: value.church.lifecycleStatus === "SUSPENDED" ? "SUSPENDED" : "ACTIVE" } : church));
  }

  return (
    <main className="min-h-screen bg-sand py-10 sm:py-14">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Bridge administration</p>
            <h1 className="mt-3 font-serif text-4xl">Control plane</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Select a site context before opening lifecycle tools. Sensitive actions require recent bridge reauthentication.</p>
          </div>
          <label className="grid min-w-64 gap-2 text-sm font-semibold">
            Selected site
            <select value={selectedChurchId} onChange={(event) => void selectChurch(event.target.value)} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2">
              <option value="">Select a site</option>
              {churches.map((church) => <option key={church.id} value={church.id}>{church.name} ({church.lifecycleStatus})</option>)}
            </select>
          </label>
        </div>
        {error && <p role="alert" className="mt-6 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">{error}</p>}
        {!overview && <div className="mt-8"><Card className="p-8"><h2 className="font-serif text-2xl">Global platform features</h2><p className="mt-2 text-sm leading-6 text-ink/60">These tools operate across the platform and do not require a site selection. Add future platform-wide tools to this panel so it remains the single global navigation source.</p>        <div className="mt-6 grid gap-3 sm:grid-cols-2"><Link href="/global-admin/onboarding" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Provisioning and onboarding</p><p className="mt-1 text-xs text-ink/60">Inspect and advance validated onboarding steps across every site.</p></Link><Link href="/global-admin/operations" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Operations dashboard</p><p className="mt-1 text-xs text-ink/60">Monitor lifecycle, onboarding, users, support, domains, and audit activity.</p></Link><Link href="/global-admin/sites" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Site inventory</p><p className="mt-1 text-xs text-ink/60">Search and filter platform sites with safe action previews.</p></Link>        <Link href="/global-admin/billing" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Subscription and billing</p><p className="mt-1 text-xs text-ink/60">Review plans, providers, periods, and controlled subscription actions.</p></Link><Link href="/global-admin/billing/config" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Billing provider configuration</p><p className="mt-1 text-xs text-ink/60">Configure encrypted Stripe and PayPal settings without exposing secrets.</p></Link><Link href="/global-admin/billing/coupons" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Coupons</p><p className="mt-1 text-xs text-ink/60">Create and manage percentage or fixed-dollar discounts with validity dates.</p></Link><Link href="/global-admin/health" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Platform health</p><p className="mt-1 text-xs text-ink/60">Check database readiness, revision, environment-safe status, and site counts.</p></Link><Link href="/global-admin/audit" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Audit and Governance</p><p className="mt-1 text-xs text-ink/60">Review platform-wide administrative activity with searchable governance filters.</p></Link><Link href="/global-admin/announcements" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Global Announcements</p><p className="mt-1 text-xs text-ink/60">Publish and schedule notices across active sites.</p></Link><Link href="/global-admin/support" className="focus-ring rounded-xl border border-ink/10 bg-white p-4 hover:border-coral"><p className="font-semibold">Support management</p><p className="mt-1 text-xs text-ink/60">Review and respond to tickets from every site.</p></Link></div></Card></div>}
        {overview && (
          <div className="mt-8 grid gap-6">
            <Card className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Selected site</p><h2 className="mt-2 font-serif text-3xl">{overview.site.name}</h2><p className="mt-1 text-sm text-ink/60">{overview.site.location ?? overview.site.slug}</p></div>
                <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink/70">{overview.lifecycle.status}</span>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-3"><Summary label="Onboarding" value={overview.lifecycle.onboardingStatus} /><Summary label="Current step" value={overview.lifecycle.currentStep ?? "Not set"} /><Summary label="Users" value={String(overview.health.users)} /></div>
              <Link href="/global-admin/site-identity" className="focus-ring mt-6 inline-block text-sm font-semibold text-coral hover:underline">Manage site identity and modules</Link>
              <Link href="/global-admin/domains" className="focus-ring ml-5 mt-6 inline-block text-sm font-semibold text-coral hover:underline">Manage domains</Link>
              <Link href="/global-admin/users" className="focus-ring ml-5 mt-6 inline-block text-sm font-semibold text-coral hover:underline">Manage users and security</Link>
              <Link href="/global-admin/announcements" className="focus-ring ml-5 mt-6 inline-block text-sm font-semibold text-coral hover:underline">Manage announcements</Link>
            </Card>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6 sm:p-8"><h2 className="font-serif text-2xl">Onboarding and provisioning</h2>{overview.operational.onboarding ? <><div className="mt-4 grid gap-3 sm:grid-cols-2"><Summary label="Status" value={overview.operational.onboarding.status} /><Summary label="Current step" value={overview.operational.onboarding.currentStep} /></div><div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">{(["siteIdentity", "modules", "security"] as const).map((key) => <span key={key} className={`rounded-full px-3 py-1 ${overview.operational.onboarding?.completion[key] ? "bg-mist text-ink/70" : "border border-ink/15 text-ink/50"}`}>{key} {overview.operational.onboarding?.completion[key] ? "complete" : "pending"}</span>)}</div></> : <p className="mt-2 text-sm text-ink/60">No onboarding record is available.</p>}</Card>
              <Card className="p-6 sm:p-8"><h2 className="font-serif text-2xl">Domains</h2>{overview.operational.domains.length ? <div className="mt-4 grid gap-3">{overview.operational.domains.map((domain) => <div key={domain.hostname} className="rounded-lg border border-ink/10 px-4 py-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{domain.hostname}</p><span className="text-xs font-semibold uppercase text-ink/55">{domain.status}</span></div><p className="mt-1 text-xs text-ink/55">{domain.kind} · TLS {domain.tlsStatus ?? "not reported"} · {domain.verification.verified ? "Verified" : "Not verified"}</p></div>)}</div> : <p className="mt-2 text-sm text-ink/60">No domains are configured.</p>}</Card>
              <Card className="p-6 sm:p-8"><h2 className="font-serif text-2xl">Subscription and billing</h2>{overview.operational.subscription ? <><div className="mt-4 grid gap-3 sm:grid-cols-2"><Summary label="Plan" value={overview.operational.subscription.plan?.name ?? "Plan unavailable"} /><Summary label="Status" value={overview.operational.subscription.status} /><Summary label="Provider" value={overview.operational.subscription.provider} /><Summary label="Interval" value={overview.operational.subscription.interval} /></div>              <p className="mt-4 text-sm text-ink/60">{overview.operational.subscription.cancelAtPeriodEnd ? "Scheduled to cancel at period end." : "Use the platform billing workspace for subscription actions."}</p><Link href="/global-admin/billing" className="focus-ring mt-5 inline-block text-sm font-semibold text-coral hover:underline">Open subscription and billing</Link></> : <p className="mt-2 text-sm text-ink/60">No subscription is recorded.</p>}</Card>
            </div>
            <Card className="p-6 sm:p-8"><h2 className="font-serif text-2xl">Lifecycle controls</h2><p className="mt-2 text-sm text-ink/60">Every transition is recorded in the global-admin audit trail.</p><div className="mt-5 flex flex-wrap gap-3">{actions.map(({ action, label }) => { const available = canTransition(overview.lifecycle.status, action); return <button key={action} type="button" disabled={busy !== null || !available} onClick={() => void changeLifecycle(action)} className="focus-ring rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">{busy === action ? "Working..." : label}</button>; })}</div></Card>
            <Card className="p-6 sm:p-8"><h2 className="font-serif text-2xl">Recent lifecycle actions</h2>{overview.recentActions.length ? <div className="mt-4 grid gap-3">{overview.recentActions.map((action) => <div key={action.id} className="rounded-lg border border-ink/10 px-4 py-3"><p className="text-sm font-semibold">{action.summary}</p><p className="mt-1 text-xs text-ink/55">{action.actor} · {new Date(action.createdAt).toLocaleString()}</p></div>)}</div> : <p className="mt-2 text-sm text-ink/60">No lifecycle actions recorded for this site.</p>}</Card>
          </div>
        )}
      </Container>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-mist/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">{label}</p><p className="mt-2 text-lg font-semibold text-ink">{value}</p></div>;
}

function canTransition(status: string, action: Action) {
  if (action === "enable") return status === "DISABLED";
  if (action === "activate") return status === "PROVISIONING" || status === "SUSPENDED";
  if (action === "suspend") return status === "ACTIVE";
  return status === "ACTIVE" || status === "SUSPENDED";
}
