"use client";

import { useEffect, useState } from "react";
import { Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

type OnePanelStatus = {
  configured: boolean;
  baseUrl: string | null;
  version: string | null;
  websiteId: number | null;
  acmeAccountId: number | null;
  dnsAccountId: number | null;
  wildcardSslId: number | null;
  platformSuffix: string;
  updatedAt: string | null;
};

type FormState = {
  baseUrl: string;
  apiKey: string;
  version: string;
  websiteId: string;
  acmeAccountId: string;
  dnsAccountId: string;
  wildcardSslId: string;
  platformSuffix: string;
};

const emptyStatus: OnePanelStatus = {
  configured: false,
  baseUrl: null,
  version: null,
  websiteId: null,
  acmeAccountId: null,
  dnsAccountId: null,
  wildcardSslId: null,
  platformSuffix: "mychurch.one",
  updatedAt: null
};

const initialForm: FormState = {
  baseUrl: "https://transporter.mychurch.one:33504",
  apiKey: "",
  version: "1.10.34-lts",
  websiteId: "",
  acmeAccountId: "",
  dnsAccountId: "",
  wildcardSslId: "",
  platformSuffix: "mychurch.one"
};

export default function OnePanelPage() {
  const [status, setStatus] = useState<OnePanelStatus>(emptyStatus);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [connectionState, setConnectionState] = useState<"idle" | "testing" | "success" | "error">("idle");

  function applyStatus(value: OnePanelStatus) {
    setStatus(value);
    setForm((current) => ({
      ...current,
      baseUrl: value.baseUrl ?? current.baseUrl,
      version: value.version ?? current.version,
      websiteId: value.websiteId?.toString() ?? "",
      acmeAccountId: value.acmeAccountId?.toString() ?? "",
      dnsAccountId: value.dnsAccountId?.toString() ?? "",
      wildcardSslId: value.wildcardSslId?.toString() ?? "",
      platformSuffix: value.platformSuffix ?? current.platformSuffix
    }));
  }

  async function loadStatus() {
    const response = await fetch("/api/global-admin/onepanel", { cache: "no-store" });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Unable to load 1Panel status.");
    applyStatus(value);
  }

  useEffect(() => {
    void loadStatus().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load 1Panel status."));
  }, []);

  async function save() {
    setError("");
    setMessage("");
    if (form.websiteId && !/^\d+$/.test(form.websiteId)) {
      setError("Website ID must be the numeric ID assigned by 1Panel.");
      return;
    }
    if (form.acmeAccountId && !/^\d+$/.test(form.acmeAccountId)) {
      setError("ACME account ID must be the local numeric record ID shown in 1Panel, not the account number from the Let's Encrypt URL or an email address.");
      return;
    }
    if (form.wildcardSslId && !/^\d+$/.test(form.wildcardSslId)) {
      setError("Wildcard certificate ID must be numeric.");
      return;
    }
    if (form.dnsAccountId && !/^\d+$/.test(form.dnsAccountId)) {
      setError("DNS account ID must be the local numeric record ID shown in 1Panel.");
      return;
    }
    const payload = { ...form, websiteId: form.websiteId ? Number(form.websiteId) : null, acmeAccountId: form.acmeAccountId ? Number(form.acmeAccountId) : null, dnsAccountId: form.dnsAccountId ? Number(form.dnsAccountId) : null, wildcardSslId: form.wildcardSslId ? Number(form.wildcardSslId) : null };
    const response = await fetch("/api/global-admin/onepanel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const value = await response.json();
    if (response.status === 428) { window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/onepanel")}&reauth=1`; return; }
    if (!response.ok) { setError(value.error ?? "Unable to save 1Panel configuration."); return; }
    applyStatus(value);
    setForm((current) => ({ ...current, apiKey: "" }));
    setConnectionState("idle");
    setMessage("1Panel configuration saved securely.");
  }

  async function test() {
    setError("");
    setMessage("");
    setConnectionState("testing");
    const response = await fetch("/api/global-admin/onepanel", { method: "PUT" });
    const value = await response.json();
    if (response.status === 428) { window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/onepanel")}&reauth=1`; return; }
    if (!response.ok) {
      setConnectionState("error");
      setError(value.error ?? "Unable to connect to 1Panel.");
      return;
    }
    setConnectionState("success");
    setMessage("1Panel connection succeeded.");
  }

  const configurationLabel = status.configured ? "Configured" : "Not configured";
  const configurationTone = status.configured ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900";

  return <main className="min-h-screen bg-sand py-10"><Container className="max-w-3xl"><div className="flex justify-end"><GlobalAdminBackLink /></div><h1 className="mt-8 font-serif text-4xl">1Panel automation</h1><p className="mt-3 text-sm text-ink/60">Configure the platform-wide 1Panel API connection for automated custom-domain binding, Let&apos;s Encrypt certificates, HTTPS, and reverse-proxy reloads. The API key is encrypted and never displayed.</p>{error && <Notification variant="danger" className="mt-5">{error}</Notification>}{message && <Notification variant="success" className="mt-5">{message}</Notification>}<Card className={`mt-6 border p-6 ${configurationTone}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em]">Setup status</p><h2 className="mt-1 font-serif text-2xl">{configurationLabel}</h2></div><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">{status.configured ? "Saved configuration found" : "Action required"}</span></div>{status.configured && <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-ink/55">Panel URL</dt><dd className="font-semibold break-all">{status.baseUrl ?? "Not set"}</dd></div><div><dt className="text-ink/55">Panel version</dt><dd className="font-semibold">{status.version ?? "Not set"}</dd></div><div><dt className="text-ink/55">Website ID</dt><dd className="font-semibold">{status.websiteId ?? "Not set"}</dd></div>  <div><dt className="text-ink/55">Let&apos;s Encrypt account ID</dt><dd className="font-semibold">{status.acmeAccountId ?? "Not set"}</dd></div><div><dt className="text-ink/55">DNS account ID</dt><dd className="font-semibold">{status.dnsAccountId ?? "Not set"}</dd></div><div><dt className="text-ink/55">Wildcard certificate ID</dt><dd className="font-semibold">{status.wildcardSslId ?? "Not configured (optional)"}</dd></div><div><dt className="text-ink/55">Platform suffix</dt><dd className="font-semibold">{status.platformSuffix}</dd></div></dl>}{status.updatedAt && <p className="mt-4 text-xs text-ink/60">Saved {new Date(status.updatedAt).toLocaleString()}</p>}<p className="mt-4 text-xs">{status.configured ? "The saved API key is retained securely but is never shown. Enter a new key only when rotating it." : "Save the panel URL, API key, website ID, and Let’s Encrypt account ID to enable automatic SSL provisioning."}</p></Card><Card className="mt-6 grid gap-4 p-6"><h2 className="font-serif text-2xl">Configuration</h2><label className="grid gap-1 text-sm font-semibold">Base URL<input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://transporter.mychurch.one:33504" className="rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">API key<input type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder={status.configured ? "Stored securely; leave blank to keep it" : "Enter the 1Panel API key"} autoComplete="off" className="rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">1Panel version<input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} placeholder="1.10.34-lts" className="rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Website ID (numeric)<input inputMode="numeric" value={form.websiteId} onChange={(event) => setForm({ ...form, websiteId: event.target.value })} placeholder="1Panel website ID" className="rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Let&apos;s Encrypt account ID (numeric)<input inputMode="numeric" value={form.acmeAccountId} onChange={(event) => setForm({ ...form, acmeAccountId: event.target.value })} placeholder="1Panel ACME account ID, not an email" className="rounded border px-3 py-2 font-normal" />  </label><label className="grid gap-1 text-sm font-semibold">DNS account ID (numeric)<input inputMode="numeric" value={form.dnsAccountId} onChange={(event) => setForm({ ...form, dnsAccountId: event.target.value })} placeholder="1Panel DNS account ID" className="rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Wildcard certificate ID (numeric)<input inputMode="numeric" value={form.wildcardSslId} onChange={(event) => setForm({ ...form, wildcardSslId: event.target.value })} placeholder="Existing *.mychurch.one certificate ID (optional)" className="rounded border px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Platform suffix<input value={form.platformSuffix} onChange={(event) => setForm({ ...form, platformSuffix: event.target.value })} placeholder="mychurch.one" className="rounded border px-3 py-2 font-normal" /></label>  <p className="text-xs text-ink/60">The website, Let&apos;s Encrypt account, and DNS account IDs are required for automatic DNS-account custom-domain certificates. The wildcard certificate ID is optional and is used for platform subdomains.</p><div className="flex flex-wrap gap-3"><button type="button" onClick={() => void save()} className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white">Save configuration</button><button type="button" onClick={() => void test()} disabled={!status.configured || connectionState === "testing"} className="rounded border border-ink/20 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{connectionState === "testing" ? "Testing connection..." : "Test connection"}</button></div>{connectionState === "success" && <p className="text-sm font-semibold text-emerald-700">Connection verified successfully.</p>}</Card></Container></main>;
}
