"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui";

type Field = { id: string; name: string; slug: string; type: string; appliesTo: string; isRequired: boolean; isActive: boolean };

export default function CustomFieldsPage() {
  const router = useRouter();
  const [fields, setFields] = useState<Field[]>([]);
  const [message, setMessage] = useState("");
  const [options, setOptions] = useState("");
  const [form, setForm] = useState({ name: "", type: "TEXT", appliesTo: "INDIVIDUAL", isRequired: false });

  function load() {
    void fetch("/api/membership/custom-fields").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load custom fields.");
      setFields(body.fields ?? []);
    }).catch((error: Error) => setMessage(error.message));
  }
  useEffect(load, []);

  async function addField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/membership/custom-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, options: options.split("\n").map((value) => value.trim()).filter(Boolean) }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to create custom field."); return; }
    setForm({ name: "", type: "TEXT", appliesTo: "INDIVIDUAL", isRequired: false }); setOptions(""); setMessage("Custom field added."); load();
  }

  async function toggle(field: Field) {
    const response = await fetch("/api/membership/custom-fields", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: field.id, isActive: !field.isActive }) });
    if (response.ok) load(); else setMessage("Unable to update custom field.");
  }

  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="mt-2 font-serif text-4xl">Custom fields</h1><p className="mt-3 max-w-2xl text-ink/60">Define additional information for individual and family records. Inactive fields remain stored but are hidden from future forms.</p></div><button type="button" onClick={() => router.back()} className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Back</button></div><form onSubmit={(event) => void addField(event)} className="mt-8 grid max-w-2xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><h2 className="font-serif text-2xl">Add a custom field</h2><label className="grid gap-1 text-sm font-semibold">Field name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="TEXT">Text</option><option value="TEXTAREA">Long text</option><option value="SELECT">Dropdown</option><option value="RADIO">Radio buttons</option><option value="CHECKBOX">Checkbox</option><option value="DATE">Date</option><option value="PHONE">Phone</option><option value="EMAIL">Email</option></select></label><label className="grid gap-1 text-sm font-semibold">Applies to<select value={form.appliesTo} onChange={(event) => setForm({ ...form, appliesTo: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="INDIVIDUAL">Individuals</option><option value="FAMILY">Families</option></select></label></div>{["SELECT", "RADIO"].includes(form.type) && <label className="grid gap-1 text-sm font-semibold">Options<span className="font-normal text-ink/60">One option per line.</span><textarea required value={options} onChange={(event) => setOptions(event.target.value)} className="focus-ring min-h-24 rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>}<label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.isRequired} onChange={(event) => setForm({ ...form, isRequired: event.target.checked })} /> Required field</label><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Add custom field</button>{message && <p role="status" className="text-sm text-coral">{message}</p>}</form><section className="mt-8 grid max-w-3xl gap-3"><h2 className="font-serif text-2xl">Defined fields</h2>{fields.map((field) => <div key={field.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-4"><div><p className="font-semibold">{field.name}{field.isRequired ? " *" : ""}</p><p className="text-sm text-ink/60">{field.appliesTo.toLowerCase()} · {field.type.toLowerCase()}{field.isActive ? "" : " · inactive"}</p></div><button type="button" onClick={() => void toggle(field)} className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm font-semibold">{field.isActive ? "Deactivate" : "Activate"}</button></div>)}{!fields.length && <p className="text-sm text-ink/60">No custom fields have been defined.</p>}</section></Container></main>;
}
