"use client";
import { useEffect, useState } from "react";
import { Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

export default function NamecheapPage() {
  const [status, setStatus] = useState<{ configured: boolean; domain: string | null; clientIpConfigured: boolean } | null>(null);
  const [form, setForm] = useState({ apiUser: "", apiKey: "", username: "", clientIp: "", domain: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/global-admin/namecheap", { cache: "no-store" }).then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error); setStatus(value); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Namecheap status.")); }, []);
  async function save() {
    setError("");
    setMessage("");
    const response = await fetch("/api/global-admin/namecheap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const value = await response.json();
    if (response.status === 428) {
      window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/namecheap")}&reauth=1`;
      return;
    }
    if (!response.ok) {
      setError(value.error ?? "Unable to save Namecheap configuration.");
      return;
    }
    setStatus(value);
    setForm({ apiUser: "", apiKey: "", username: "", clientIp: "", domain: "" });
    setMessage("Saved. Credentials remain encrypted and masked.");
  }
  const fields = [
    ["apiUser", "API user", "Your Namecheap API username."],
    ["apiKey", "API key", "Create this in Namecheap Profile → Tools → API Access."],
    ["username", "Account username (optional)", "Usually the same as the API user; leave blank to reuse it."],
    ["clientIp", "Allowlisted client IP", "The public IPv4 address of this server, allowlisted in Namecheap API Access."],
    ["domain", "Registered Namecheap domain", "The root domain managed at Namecheap, such as mychurch.one; do not enter beta.mychurch.one."]
  ] as const;
  return <main className="min-h-screen bg-sand py-10"><Container className="max-w-3xl"><div className="flex justify-end"><GlobalAdminBackLink /></div><h1 className="mt-8 font-serif text-4xl">Namecheap DNS configuration</h1><p className="mt-3 text-sm text-ink/60">These settings apply to the entire platform, not to an individual site. Saving encrypted credentials requires a fresh Global Admin sign-in.</p>{error && <Notification variant="danger" className="mt-5">{error}</Notification>}{message && <Notification variant="success" className="mt-5">{message}</Notification>}<Card className="mt-6 p-6"><p className="text-sm">Status: {status?.configured ? "configured" : "not configured"} · Domain: {status?.domain ?? "not set"} · Client IP: {status?.clientIpConfigured ? "configured" : "not set"}</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(([name, label, help]) => <label key={name} className="grid gap-1 text-sm font-semibold">{label}<input type={name === "apiKey" ? "password" : "text"} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} placeholder={label} autoComplete="off" className="rounded border px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/55">{help}</span></label>)}</div><button type="button" onClick={() => void save()} className="mt-5 rounded bg-ink px-4 py-2 text-sm font-semibold text-white">Save configuration</button></Card></Container></main>;
}
