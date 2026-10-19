"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Container, Notification } from "@/components/ui";

type Domain = {
  id: string;
  hostname: string;
  kind: "PLATFORM_SUBDOMAIN" | "CUSTOM_DOMAIN";
  status: string;
  isPrimary: boolean;
  verifiedAt: string | null;
  tlsStatus: string | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  dnsGuidance: string | null;
  verificationRecord: { type: "TXT"; name: string; value: string } | null;
};

export function DomainsWorkspace() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hostname, setHostname] = useState("");
  const [kind, setKind] = useState<Domain["kind"] | "NEW_DOMAIN">("CUSTOM_DOMAIN");
  const [purchasePricing, setPurchasePricing] = useState<{ available: boolean; included: boolean; price: string; currency: string; purchasedDomain: { hostname: string; status: string } | null } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/domains", { cache: "no-store" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error ?? "Unable to load domains.");
    setDomains(value.domains ?? []);
  }

  useEffect(() => {
    void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load domains."));
    void fetch("/api/domains/purchase", { cache: "no-store" }).then(async (response) => {
      const value = await response.json().catch(() => ({}));
      if (response.ok) {
        setPurchasePricing(value);
        if (value.purchasedDomain) setKind("CUSTOM_DOMAIN");
      }
    });
  }, []);

  async function addDomain() {
    setError("");
    setMessage("");
    if (kind === "NEW_DOMAIN") {
      const response = await fetch("/api/domains/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname })
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(value.error ?? "Unable to start domain purchase.");
        return;
      }
      setHostname("");
      setMessage(value.billing?.included ? "The domain is included with your plan. Its registration request was submitted." : `Domain availability confirmed. Complete the annual ${value.billing?.currency ?? ""} ${value.billing?.price ?? ""} domain authorization to continue.`);
      await load();
      if (value.billing?.checkoutUrl) window.location.assign(value.billing.checkoutUrl);
      return;
    }
    const response = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostname, kind })
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(value.error ?? "Unable to add domain.");
      return;
    }
    setHostname("");
    setMessage("Domain added. Add the DNS verification record shown below, then retry verification.");
    await load();
  }

  async function verifyDomain(id: string) {
    setError("");
    setMessage("");
    const response = await fetch(`/api/domains/${id}/verify`, { method: "POST" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(value.error ?? "Unable to verify domain.");
      return;
    }
    setMessage("DNS verification completed. Let’s Encrypt SSL provisioning was started.");
    await load();
  }

  async function retryTls(id: string) {
    setError("");
    setMessage("");
    const response = await fetch(`/api/domains/${id}/tls`, { method: "POST" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(value.error ?? "Unable to provision SSL.");
      return;
    }
    setMessage("SSL provisioning completed.");
    await load();
  }

  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container>
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site administration</p>
    <h1 className="mt-2 font-serif text-4xl">Domains</h1>
    <p className="mt-3 max-w-2xl text-sm text-ink/60">Manage this church site&apos;s platform and external domains, or purchase a new domain when your subscription includes the domain add-on.</p>
    {error && <Notification variant="danger" className="mt-6">{error}</Notification>}
    {message && <Notification variant="success" className="mt-6">{message}</Notification>}
    <Card className="mt-8 grid gap-4 p-6"><div className="flex flex-wrap gap-3">
      <select aria-label="Domain type" value={kind} onChange={(event) => setKind(event.target.value as Domain["kind"] | "NEW_DOMAIN")} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2"><option value="CUSTOM_DOMAIN">External domain</option><option value="PLATFORM_SUBDOMAIN">Platform subdomain</option><option value="NEW_DOMAIN" disabled={Boolean(purchasePricing?.purchasedDomain)}>Purchase a new domain</option></select>
      <input aria-label="Domain hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="www.example.org" className="focus-ring min-w-[240px] flex-1 rounded-lg border border-ink/15 px-3 py-2" />
      <Button type="button" onClick={() => void addDomain()}>{kind === "NEW_DOMAIN" ? "Check and purchase" : "Add domain"}</Button>
    </div>{purchasePricing?.purchasedDomain ? <p className="text-sm text-coral">This site already has a purchased domain ({purchasePricing.purchasedDomain.hostname}, {purchasePricing.purchasedDomain.status.toLowerCase()}). To remove or replace it, <Link href="/account/support" className="font-semibold underline">contact support</Link> first. A global administrator must review any refund or partial-year billing adjustment.</p> : kind === "NEW_DOMAIN" && <p className="text-sm text-ink/60">{purchasePricing?.available ? purchasePricing.included ? "Domain registration is included with this plan." : `Annual domain authorization: ${purchasePricing.currency} ${purchasePricing.price}. Premium domain registration pricing may be higher.` : "A plan with domain registration enabled is required. Domain availability and any premium price are checked before authorization."}</p>}</Card>
    <section className="mt-8 grid gap-4">{domains.map((domain) => <Card key={domain.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-2xl">{domain.hostname}</h2><p className="mt-1 text-sm text-ink/60">{domain.kind === "CUSTOM_DOMAIN" ? "External domain" : "Platform subdomain"} · {domain.status}</p>{domain.dnsGuidance && <p className="mt-2 text-xs text-ink/60">{domain.dnsGuidance}</p>}{domain.lastError && <p className="mt-2 rounded border border-coral/20 bg-coral/5 p-2 text-xs text-coral">{domain.lastError}</p>}{domain.lastCheckedAt && <p className="mt-2 text-xs text-ink/45">Last checked: {new Date(domain.lastCheckedAt).toLocaleString()}</p>}{domain.verificationRecord && <div className="mt-4 rounded-lg border border-ink/10 bg-mist/40 p-3 text-xs"><p className="font-semibold text-ink">DNS verification record</p><dl className="mt-2 grid gap-1 text-ink/70"><div><dt className="inline font-semibold">Type: </dt><dd className="inline">{domain.verificationRecord.type}</dd></div><div><dt className="inline font-semibold">Name/host: </dt><dd className="break-all font-mono">{domain.verificationRecord.name}</dd></div><div><dt className="inline font-semibold">Value: </dt><dd className="break-all font-mono">{domain.verificationRecord.value}</dd></div></dl><p className="mt-2 text-ink/55">Add this TXT record at your DNS provider, wait for it to propagate, then retry verification.</p><Button type="button" onClick={() => void verifyDomain(domain.id)} className="mt-3">Verify DNS record</Button></div>}{domain.tlsStatus === "FAILED" && <Button type="button" onClick={() => void retryTls(domain.id)} className="mt-3">Retry SSL provisioning</Button>}</div><span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">{domain.tlsStatus ?? "TLS pending"}</span></div></Card>)}{domains.length === 0 && <Card className="p-6 text-sm text-ink/60">No domains configured for this site.</Card>}</section>
  </Container></main>;
}
