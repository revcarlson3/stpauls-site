"use client";

import { useEffect, useState } from "react";
import { Button, Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";
import { MODULES } from "@/lib/modules";
import { US_STATES } from "@/lib/us-states";

type Form = { name: string; slug: string; url: string; tagline: string; addressStreet: string; city: string; state: string; postalCode: string; phone: string; email: string; taxId: string; enabledModules: string[] };

export default function GlobalAdminSiteIdentityPage() {
  const [form, setForm] = useState<Form | null>(null);
  const [siteName, setSiteName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([fetch("/api/global-admin/context"), fetch("/api/global-admin/site-identity")]).then(async ([contextResponse, identityResponse]) => {
      if (!contextResponse.ok || !identityResponse.ok) throw new Error("Select an active site before editing identity.");
      const context = await contextResponse.json();
      const value = await identityResponse.json();
      setSiteName(context.church?.name ?? value.site?.name ?? "Selected site");
      setForm(value.site);
    }).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load site identity."));
  }, []);
  function update(field: keyof Form, value: string | string[]) {
    setForm((current) => current ? { ...current, [field]: value } : current);
  }
  async function save() {
    if (!form) return;
    setMessage("");
    setError("");
    const response = await fetch("/api/global-admin/site-identity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(value.error ?? "Unable to save site identity.");
      return;
    }
    setForm(value.site);
    setMessage("Site identity and modules saved.");
  }
  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Selected site</p><h1 className="mt-2 font-serif text-4xl">{siteName || "Site identity"}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Edit tenant-owned identity and enabled modules. Changes are scoped to the selected site and recorded in the bridge audit log.</p></div><GlobalAdminBackLink /></div>{error && <Notification variant="danger" className="mt-6 max-w-3xl">{error}</Notification>}{form && <Card className="mt-8 grid max-w-4xl gap-6 p-6 sm:p-8"><section className="grid gap-4"><h2 className="font-serif text-2xl">Church identity</h2><label className="grid gap-1 text-sm font-semibold">Church name<input value={form.name} onChange={(event) => update("name", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Site URL<input type="url" placeholder="https://example.org" value={form.url} onChange={(event) => update("url", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Tagline<input value={form.tagline} onChange={(event) => update("tagline", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Street address<input value={form.addressStreet} onChange={(event) => update("addressStreet", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm font-semibold">City<input value={form.city} onChange={(event) => update("city", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">State<select value={form.state} onChange={(event) => update("state", event.target.value)} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="">Select</option>{US_STATES.map(([abbreviation, name]) => <option key={abbreviation} value={abbreviation}>{name} ({abbreviation})</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">ZIP<input value={form.postalCode} onChange={(event) => update("postalCode", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Phone<input value={form.phone} onChange={(event) => update("phone", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Email<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div><label className="grid gap-1 text-sm font-semibold">Church tax ID / EIN<input value={form.taxId} onChange={(event) => update("taxId", event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></section><section className="grid gap-3 border-t border-ink/10 pt-6"><h2 className="font-serif text-2xl">Enabled modules</h2><p className="text-sm text-ink/60">Only known modules can be enabled. Tenant administrators will see modules according to their permissions.</p>{MODULES.map((module) => <label key={module.slug} className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.enabledModules.includes(module.slug)} onChange={(event) => update("enabledModules", event.target.checked ? [...form.enabledModules, module.slug] : form.enabledModules.filter((slug) => slug !== module.slug))} />{module.name}</label>)}</section><div className="flex items-center gap-4"><Button type="button" onClick={() => void save()}>Save changes</Button>{message && <Notification variant="success">{message}</Notification>}</div></Card>}</Container></main>;
}
