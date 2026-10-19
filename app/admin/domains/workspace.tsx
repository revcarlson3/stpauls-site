"use client";

import { useEffect, useState } from "react";
import { Button, Card, Container, Notification } from "@/components/ui";

type Domain = {
  id: string;
  hostname: string;
  kind: "PLATFORM_SUBDOMAIN" | "CUSTOM_DOMAIN";
  status: string;
  isPrimary: boolean;
  verifiedAt: string | null;
  tlsStatus: string | null;
  dnsGuidance: string | null;
};

export function DomainsWorkspace() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hostname, setHostname] = useState("");
  const [kind, setKind] = useState<Domain["kind"]>("CUSTOM_DOMAIN");
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
  }, []);

  async function addDomain() {
    setError("");
    setMessage("");
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
    setMessage("Domain added. DNS verification and hosting attachment remain pending.");
    await load();
  }

  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container>
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site administration</p>
    <h1 className="mt-2 font-serif text-4xl">Domains</h1>
    <p className="mt-3 max-w-2xl text-sm text-ink/60">Manage this church site&apos;s platform and external domains. Registration, transfer, and global platform actions are not available here.</p>
    {error && <Notification variant="danger" className="mt-6">{error}</Notification>}
    {message && <Notification variant="success" className="mt-6">{message}</Notification>}
    <Card className="mt-8 grid gap-4 p-6"><div className="flex flex-wrap gap-3">
      <select aria-label="Domain type" value={kind} onChange={(event) => setKind(event.target.value as Domain["kind"])} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2"><option value="CUSTOM_DOMAIN">External domain</option><option value="PLATFORM_SUBDOMAIN">Platform subdomain</option></select>
      <input aria-label="Domain hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="www.example.org" className="focus-ring min-w-[240px] flex-1 rounded-lg border border-ink/15 px-3 py-2" />
      <Button type="button" onClick={() => void addDomain()}>Add domain</Button>
    </div></Card>
    <section className="mt-8 grid gap-4">{domains.map((domain) => <Card key={domain.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-2xl">{domain.hostname}</h2><p className="mt-1 text-sm text-ink/60">{domain.kind === "CUSTOM_DOMAIN" ? "External domain" : "Platform subdomain"} · {domain.status}</p>{domain.dnsGuidance && <p className="mt-2 text-xs text-ink/60">{domain.dnsGuidance}</p>}</div><span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">{domain.tlsStatus ?? "TLS pending"}</span></div></Card>)}{domains.length === 0 && <Card className="p-6 text-sm text-ink/60">No domains configured for this site.</Card>}</section>
  </Container></main>;
}
