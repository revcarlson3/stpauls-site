"use client";

import { useEffect, useState } from "react";
import { Button, Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

type Domain = {
  id: string;
  hostname: string;
  kind: "PLATFORM_SUBDOMAIN" | "CUSTOM_DOMAIN";
  status: string;
  isPrimary: boolean;
  tlsStatus: string | null;
  statusMessage: string;
};

export default function GlobalAdminDomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/global-admin/domains", { cache: "no-store" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error ?? "Unable to load domains.");
    setDomains(value.domains ?? []);
  }

  useEffect(() => {
    void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load domains."));
  }, []);

  async function add(kind: Domain["kind"]) {
    setError("");
    setMessage("");
    const response = await fetch("/api/global-admin/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "CUSTOM_DOMAIN" ? { hostname, kind } : { kind })
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 428) {
        window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/domains")}&reauth=1`;
        return;
      }
      setError(value.error ?? "Unable to add domain.");
      return;
    }
    setHostname("");
    setMessage(kind === "CUSTOM_DOMAIN" ? "Custom domain added. Follow the DNS and TLS instructions below." : "Platform subdomain created and activated.");
    await load();
  }

  async function action(id: string, actionName: "check" | "disable" | "primary") {
    setError("");
    setMessage("");
    const path = actionName === "check" ? `/api/global-admin/domains/${id}/check` : actionName === "primary" ? `/api/global-admin/domains/${id}/primary` : `/api/global-admin/domains/${id}`;
    const response = await fetch(path, { method: actionName === "disable" ? "DELETE" : "POST" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 428) {
        window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/domains")}&reauth=1`;
        return;
      }
      setError(value.error ?? "Unable to update domain.");
      return;
    }
    setMessage(actionName === "primary" ? "Primary domain updated." : actionName === "check" ? "Status checked; external verification is still manual." : "Domain disabled.");
    await load();
  }

  const platformDomains = domains.filter((domain) => domain.kind === "PLATFORM_SUBDOMAIN");
  const customDomains = domains.filter((domain) => domain.kind === "CUSTOM_DOMAIN");
  const domainCard = (domain: Domain) => (
    <Card key={domain.id} className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{domain.hostname} {domain.isPrimary && <span className="ml-2 rounded-full bg-coral/10 px-2 py-1 text-xs text-coral">Primary</span>}</h3>
          <p className="mt-1 text-xs text-ink/55">{domain.status} · TLS {domain.tlsStatus ?? "not checked"}</p>
          <p className="mt-2 text-sm text-ink/60">{domain.statusMessage}</p>
          {domain.kind === "CUSTOM_DOMAIN" && <p className="mt-2 text-xs text-ink/55">Point your DNS record to the platform and complete TLS validation before selecting this as primary.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {domain.status === "ACTIVE" && !domain.isPrimary && <Button type="button" onClick={() => void action(domain.id, "primary")} variant="secondary">Make primary</Button>}
          {domain.kind === "CUSTOM_DOMAIN" && <Button type="button" onClick={() => void action(domain.id, "check")} variant="secondary">Check status</Button>}
          <Button type="button" onClick={() => void action(domain.id, "disable")} variant="secondary" disabled={domain.status === "DISABLED"}>{domain.status === "DISABLED" ? "Disabled" : "Disable"}</Button>
        </div>
      </div>
    </Card>
  );

  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container><div className="flex justify-end"><GlobalAdminBackLink /></div><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Selected site</p><h1 className="mt-2 font-serif text-4xl">Manage domains</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Platform subdomains are generated and managed by mychurch.one. Custom domains remain pending until the church completes DNS and TLS verification; this console never fakes that external verification.</p>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}{message && <Notification variant="success" className="mt-6">{message}</Notification>}<Card className="mt-8 grid gap-4 p-6 sm:p-8"><div><h2 className="font-serif text-2xl">Platform subdomain</h2><p className="mt-1 text-sm text-ink/60">Generate a unique active hostname using the configured platform suffix. No external DNS claim is required.</p></div><Button type="button" onClick={() => void add("PLATFORM_SUBDOMAIN")} className="w-fit">Generate platform subdomain</Button></Card><Card className="mt-6 grid gap-4 p-6 sm:p-8"><div><h2 className="font-serif text-2xl">Custom domain</h2><p className="mt-1 text-sm text-ink/60">Add a hostname owned by the church. It will remain pending until DNS and TLS are verified outside this application.</p></div><div className="flex flex-wrap gap-3"><input aria-label="Custom hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="www.example.org" className="focus-ring min-w-[260px] flex-1 rounded-lg border border-ink/15 px-3 py-2" /><Button type="button" onClick={() => void add("CUSTOM_DOMAIN")}>Add custom domain</Button></div></Card><section className="mt-8 grid gap-4"><h2 className="font-serif text-2xl">Platform subdomains</h2>{platformDomains.map(domainCard)}{!platformDomains.length && <Card className="p-6 text-sm text-ink/60">No platform subdomain has been generated for this site.</Card>}</section><section className="mt-8 grid gap-4"><h2 className="font-serif text-2xl">Custom domains</h2>{customDomains.map(domainCard)}{!customDomains.length && <Card className="p-6 text-sm text-ink/60">No custom domains are configured for this site.</Card>}</section></Container></main>;
}
