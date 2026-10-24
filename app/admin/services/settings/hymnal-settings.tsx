"use client";

import { useEffect, useState } from "react";

type Hymnal = { code: string; name: string; sourceUrl: string };
type PrimaryHymnal = { id: string; code: string; name: string; importedAt: string; _count: { hymns: number } } | null;

export function HymnalSettings() {
  const [hymnals, setHymnals] = useState<Hymnal[]>([]);
  const [selected, setSelected] = useState("");
  const [primary, setPrimary] = useState<PrimaryHymnal>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/services/hymnals").then((response) => response.json()).then((body) => {
      setHymnals(body.hymnals ?? []);
      setPrimary(body.primaryHymnal ?? null);
      setSelected(body.primaryHymnal?.code ?? "");
    }).catch(() => setMessage("Unable to load hymnals.")).finally(() => setLoading(false));
  }, []);

  async function save() {
    const hymnal = hymnals.find((item) => item.code === selected);
    if (!hymnal) return;
    const oldName = primary?.name ? ` This will remove the currently imported ${primary.name} catalog.` : "";
    if (!window.confirm(`Import ${hymnal.name} into the Services database?${oldName}`)) return;
    setSaving(true);
    setMessage("Importing hymnal metadata...");
    const response = await fetch("/api/services/hymnals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: hymnal.code, name: hymnal.name }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Unable to import hymnal metadata.");
      setSaving(false);
      return;
    }
    setPrimary(body.primaryHymnal);
    setMessage(`${body.primaryHymnal.name} imported with ${body.primaryHymnal._count.hymns} hymns.`);
    setSaving(false);
  }

  return <section className="mt-8 rounded-[var(--site-radius-card)] border border-ink/10 bg-white p-6 shadow-sm">
    <h2 className="font-serif text-2xl">Primary hymnal</h2>
    <p className="mt-2 max-w-2xl text-sm text-ink/60">Choose the hymnal used for hymn lookup when creating worship services. Changing it replaces the currently imported catalog for this church.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <select disabled={loading || saving} value={selected} onChange={(event) => setSelected(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2">
        <option value="">Select a hymnal</option>
        {hymnals.map((hymnal) => <option key={hymnal.code} value={hymnal.code}>{hymnal.name}</option>)}
      </select>
      <button type="button" disabled={!selected || saving} onClick={() => void save()} className="focus-ring rounded-full bg-coral px-5 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Importing..." : selected === primary?.code ? "Re-import hymnal" : "Import hymnal"}</button>
    </div>
    {primary && <p className="mt-4 text-sm text-ink/60">Current catalog: <strong>{primary.name}</strong> · {primary._count.hymns} hymns imported.</p>}
    {message && <p className="mt-4 text-sm font-semibold text-coral">{message}</p>}
  </section>;
}
