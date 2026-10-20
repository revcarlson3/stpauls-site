"use client";
import { useEffect, useState } from "react";
import { Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

export default function NamecheapPage() {
  const [status, setStatus] = useState<{ configured: boolean; domain: string | null; clientIpConfigured: boolean; registrationDnsRecords: Array<{ host: string; type: string; address: string; ttl: number }>; autoVerificationRecord: boolean } | null>(null);
  const [form, setForm] = useState({ apiUser: "", apiKey: "", username: "", clientIp: "", domain: "", registrationDnsRecords: [{ host: "@", type: "A", address: "", ttl: 300 }], autoVerificationRecord: true });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/global-admin/namecheap", { cache: "no-store" }).then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error); setStatus(value); setForm((current) => ({ ...current, registrationDnsRecords: value.registrationDnsRecords?.length ? value.registrationDnsRecords : current.registrationDnsRecords, autoVerificationRecord: value.autoVerificationRecord !== false })); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Namecheap status.")); }, []);
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
    setForm({ apiUser: "", apiKey: "", username: "", clientIp: "", domain: "", registrationDnsRecords: [{ host: "@", type: "A", address: "", ttl: 300 }], autoVerificationRecord: true });
    setMessage("Saved. Credentials remain encrypted and masked.");
  }
  const fields = [
    ["apiUser", "API user", "Your Namecheap API username."],
    ["apiKey", "API key", "Create this in Namecheap Profile → Tools → API Access."],
    ["username", "Account username (optional)", "Usually the same as the API user; leave blank to reuse it."],
    ["clientIp", "Allowlisted client IP", "The public IPv4 address of this server, allowlisted in Namecheap API Access."],
    ["domain", "Registered Namecheap domain", "The root domain managed at Namecheap, such as mychurch.one; do not enter beta.mychurch.one."]
  ] as const;
  return <main className="min-h-screen bg-sand py-10"><Container className="max-w-3xl"><div className="flex justify-end"><GlobalAdminBackLink /></div><h1 className="mt-8 font-serif text-4xl">Namecheap DNS configuration</h1><p className="mt-3 text-sm text-ink/60">These settings apply to the entire platform, not to an individual site. Saving encrypted credentials requires a fresh Global Admin sign-in.</p>{error && <Notification variant="danger" className="mt-5">{error}</Notification>}{message && <Notification variant="success" className="mt-5">{message}</Notification>}<Card className="mt-6 p-6"><p className="text-sm">Status: {status?.configured ? "configured" : "not configured"} · Domain: {status?.domain ?? "not set"} · Client IP: {status?.clientIpConfigured ? "configured" : "not set"}</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(([name, label, help]) => <label key={name} className="grid gap-1 text-sm font-semibold">{label}<input type={name === "apiKey" ? "password" : "text"} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} placeholder={label} autoComplete="off" className="rounded border px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/55">{help}</span></label>)}</div><div className="mt-8 border-t border-ink/10 pt-6"><h2 className="font-serif text-2xl">Records for newly registered domains</h2><p className="mt-1 text-sm text-ink/60">These records are copied into each newly registered Namecheap domain. The verification TXT record is generated per tenant domain and added automatically when enabled.</p><div className="mt-4 grid gap-3">{form.registrationDnsRecords.map((record, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_110px_1.5fr_90px_auto]"><input aria-label={`DNS host ${index + 1}`} value={record.host} onChange={(event) => { const records = [...form.registrationDnsRecords]; records[index] = { ...record, host: event.target.value }; setForm({ ...form, registrationDnsRecords: records }); }} placeholder="@" className="rounded border px-3 py-2" /><select aria-label={`DNS type ${index + 1}`} value={record.type} onChange={(event) => { const records = [...form.registrationDnsRecords]; records[index] = { ...record, type: event.target.value }; setForm({ ...form, registrationDnsRecords: records }); }} className="rounded border px-2 py-2"><option>A</option><option>AAAA</option><option>CNAME</option><option>TXT</option></select><input aria-label={`DNS value ${index + 1}`} value={record.address} onChange={(event) => { const records = [...form.registrationDnsRecords]; records[index] = { ...record, address: event.target.value }; setForm({ ...form, registrationDnsRecords: records }); }} placeholder="Record value" className="rounded border px-3 py-2" /><input aria-label={`DNS TTL ${index + 1}`} type="number" min="60" max="86400" value={record.ttl} onChange={(event) => { const records = [...form.registrationDnsRecords]; records[index] = { ...record, ttl: Number(event.target.value) }; setForm({ ...form, registrationDnsRecords: records }); }} className="rounded border px-3 py-2" />{form.registrationDnsRecords.length > 1 && <button type="button" onClick={() => setForm({ ...form, registrationDnsRecords: form.registrationDnsRecords.filter((_, itemIndex) => itemIndex !== index) })} className="rounded border px-3 py-2 text-sm">Remove</button>}</div>)}</div><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => setForm({ ...form, registrationDnsRecords: [...form.registrationDnsRecords, { host: "@", type: "A", address: "", ttl: 300 }] })} className="rounded border border-ink/20 px-3 py-2 text-sm font-semibold">Add record</button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoVerificationRecord} onChange={(event) => setForm({ ...form, autoVerificationRecord: event.target.checked })} />Add tenant verification TXT record automatically</label></div></div><button type="button" onClick={() => void save()} className="mt-5 rounded bg-ink px-4 py-2 text-sm font-semibold text-white">Save configuration</button></Card></Container></main>;
}
