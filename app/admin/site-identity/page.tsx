"use client";

import { useEffect, useState } from "react";
import { Button, Container, Notification } from "@/components/ui";
import { US_STATES } from "@/lib/us-states";

export default function SiteIdentityPage() {
  const [form, setForm] = useState({ siteName: "", siteUrl: "", siteAddressStreet: "", siteAddressCity: "", siteAddressState: "", siteAddressZip: "", sitePhone: "", siteEmail: "", siteTaxId: "" });
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "danger">("success");

  useEffect(() => {
    void fetch("/api/site-identity").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load site identity.");
      const value = await response.json();
      setForm({ siteName: value.siteName ?? "", siteUrl: value.siteUrl ?? "", siteAddressStreet: value.siteAddressStreet ?? "", siteAddressCity: value.siteAddressCity ?? "", siteAddressState: value.siteAddressState ?? "", siteAddressZip: value.siteAddressZip ?? "", sitePhone: value.sitePhone ?? "", siteEmail: value.siteEmail ?? "", siteTaxId: value.siteTaxId ?? "" });
    }).catch((error: Error) => { setMessageVariant("danger"); setMessage(error.message); });
  }, []);

  async function save() {
    const response = await fetch("/api/site-identity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setMessageVariant(response.ok ? "success" : "danger");
    setMessage(response.ok ? "Saved." : "Unable to save site identity.");
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site Settings</p>
        <h1 className="mt-2 font-serif text-4xl">Site Identity</h1>
        <p className="mt-3 max-w-2xl text-ink/60">Set the church identity used throughout the application and on official contribution statements.</p>
        <section className="mt-8 grid max-w-2xl gap-5 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
          <label className="grid gap-1 text-sm font-semibold">Church name<input value={form.siteName} onChange={(event) => setForm({ ...form, siteName: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold">Site URL<input type="url" placeholder="https://example.org" value={form.siteUrl} onChange={(event) => setForm({ ...form, siteUrl: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          <h2 className="border-t border-ink/10 pt-4 font-serif text-xl">Church statement information</h2>
          <label className="grid gap-1 text-sm font-semibold">Street address<input value={form.siteAddressStreet} onChange={(event) => setForm({ ...form, siteAddressStreet: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,7rem)]"><label className="grid min-w-0 gap-1 text-sm font-semibold">City<input value={form.siteAddressCity} onChange={(event) => setForm({ ...form, siteAddressCity: event.target.value })} className="focus-ring min-w-0 max-w-full rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid min-w-0 gap-1 text-sm font-semibold">State<select value={form.siteAddressState} onChange={(event) => setForm({ ...form, siteAddressState: event.target.value })} className="focus-ring min-w-0 max-w-full rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="">Select</option>{US_STATES.map(([abbreviation, name]) => <option key={abbreviation} value={abbreviation}>{name} ({abbreviation})</option>)}</select></label><label className="grid min-w-0 gap-1 text-sm font-semibold">ZIP<input value={form.siteAddressZip} onChange={(event) => setForm({ ...form, siteAddressZip: event.target.value })} className="focus-ring min-w-0 max-w-full rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Phone<input value={form.sitePhone} onChange={(event) => setForm({ ...form, sitePhone: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Email<input type="email" value={form.siteEmail} onChange={(event) => setForm({ ...form, siteEmail: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div>
          <label className="grid gap-1 text-sm font-semibold">Church tax ID / EIN<input value={form.siteTaxId} onChange={(event) => setForm({ ...form, siteTaxId: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          <div className="flex items-center gap-4"><Button type="button" onClick={() => void save()}>Save site identity</Button>{message && <Notification variant={messageVariant}>{message}</Notification>}</div>
        </section>
      </Container>
    </main>
  );
}
