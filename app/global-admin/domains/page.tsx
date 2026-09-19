"use client";

import { useEffect, useState } from "react";
import { Button, Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

type Domain = { id: string; hostname: string; kind: string; status: string; tlsStatus: string | null; lastCheckedAt: string | null; statusMessage: string };

export default function GlobalAdminDomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hostname, setHostname] = useState("");
  const [kind, setKind] = useState("CUSTOM_DOMAIN");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/global-admin/domains", { cache: "no-store" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error ?? "Unable to load domains.");
    setDomains(value.domains ?? []);
  }
  useEffect(() => { void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load domains.")); }, []);
  async function add() {
    setError(""); setMessage("");
    const response = await fetch("/api/global-admin/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostname, kind }) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) { setError(response.status === 428 ? "Recent bridge reauthentication is required." : value.error ?? "Unable to add domain."); return; }
    setHostname(""); setMessage("Domain added. DNS and TLS verification is pending manual confirmation."); await load();
  }
  async function action(id: string, actionName: "check" | "disable") {
    setError(""); setMessage("");
    const response = await fetch(`/api/global-admin/domains/${id}${actionName === "check" ? "/check" : ""}`, { method: actionName === "check" ? "POST" : "DELETE" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) { setError(response.status === 428 ? "Recent bridge reauthentication is required." : value.error ?? "Unable to update domain."); return; }
    setMessage(actionName === "check" ? "Status checked; manual DNS/TLS verification is still required." : "Domain disabled."); await load();
  }
  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Selected site</p><h1 className="mt-2 font-serif text-4xl">Domains</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Manage hostnames for the selected site. This environment does not perform external DNS or TLS verification, so status checks remain explicitly pending manual verification.</p></div><GlobalAdminBackLink /></div>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}{message && <Notification variant="success" className="mt-6">{message}</Notification>}<Card className="mt-8 grid gap-4 p-6 sm:p-8"><h2 className="font-serif text-2xl">Add hostname</h2><div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]"><input aria-label="Hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="www.example.org" className="focus-ring rounded-lg border border-ink/15 px-3 py-2" /><select aria-label="Domain kind" value={kind} onChange={(event) => setKind(event.target.value)} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2"><option value="CUSTOM_DOMAIN">Custom domain</option><option value="PLATFORM_SUBDOMAIN">Platform subdomain</option></select><Button type="button" onClick={() => void add()}>Add domain</Button></div></Card><div className="mt-6 grid gap-4">{domains.map((domain) => <Card key={domain.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">{domain.hostname}</h2><p className="mt-1 text-xs text-ink/55">{domain.kind} · {domain.status} · TLS {domain.tlsStatus ?? "not checked"}</p><p className="mt-2 text-sm text-ink/60">{domain.statusMessage}</p></div><div className="flex gap-2"><Button type="button" onClick={() => void action(domain.id, "check")} variant="secondary">Check status</Button><Button type="button" onClick={() => void action(domain.id, "disable")} variant="secondary" disabled={domain.status === "DISABLED"}>Disable</Button></div></div></Card>)}{!domains.length && <Card className="p-6 text-sm text-ink/60">No domains are configured for this site.</Card>}</div></Container></main>;
}
