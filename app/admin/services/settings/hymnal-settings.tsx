"use client";

import { useEffect, useState } from "react";

type Hymnal = { code: string; name: string; sourceUrl: string };
type PrimaryHymnal = { id: string; code: string; name: string; importedAt: string; _count: { hymns: number } } | null;
type Hymn = { id: string; number: string | null; title: string; tuneName: string | null; lyricsRights: string; musicRights: string; arrangementRights: string; lyricsText: string | null; musicImageUrl: string | null; musicUrl: string | null; rightsSourceUrl: string | null; rightsNotes: string | null };

export function HymnalSettings() {
  const [hymnals, setHymnals] = useState<Hymnal[]>([]);
  const [selected, setSelected] = useState("");
  const [primary, setPrimary] = useState<PrimaryHymnal>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [hymnQuery, setHymnQuery] = useState("");
  const [hymnResults, setHymnResults] = useState<Hymn[]>([]);
  const [editing, setEditing] = useState<Hymn | null>(null);

  useEffect(() => {
    void fetch("/api/services/hymnals").then((response) => response.json()).then((body) => {
      setHymnals(body.hymnals ?? []);
      setPrimary(body.primaryHymnal ?? null);
      setSelected(body.primaryHymnal?.code ?? "");
    }).catch(() => setMessage("Unable to load hymnals.")).finally(() => setLoading(false));
  }, []);

  async function searchHymns(query: string) {
    setHymnQuery(query);
    if (!query.trim()) {
      setHymnResults([]);
      return;
    }
    const response = await fetch(`/api/services/hymns?q=${encodeURIComponent(query)}`);
    const body = await response.json().catch(() => ({}));
    setHymnResults(body.hymns ?? []);
  }

  async function saveRights(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    const response = await fetch(`/api/services/hymns/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Unable to save hymn rights.");
      return;
    }
    setEditing(body.hymn);
    setHymnResults((current) => current.map((hymn) => hymn.id === body.hymn.id ? body.hymn : hymn));
    setMessage("Hymn rights and public-domain content saved.");
  }

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
    {primary && <div className="mt-8 border-t border-ink/10 pt-6">
      <h3 className="font-serif text-xl">Public-domain hymn content</h3>
      <p className="mt-2 max-w-2xl text-sm text-ink/60">Search an imported hymn to record separate rights decisions. Content is shown publicly only when its rights are explicitly marked public domain. Do not paste copyrighted lyrics or upload copyrighted scans.</p>
      <input value={hymnQuery} onChange={(event) => void searchHymns(event.target.value)} className="focus-ring mt-4 w-full rounded-lg border border-ink/15 px-3 py-2" placeholder="Search by hymn number or title" />
      {hymnResults.length > 0 && <div className="mt-2 grid gap-1 rounded-lg bg-mist p-2 text-sm">{hymnResults.map((hymn) => <button type="button" key={hymn.id} onClick={() => { setEditing(hymn); setHymnResults([]); }} className="rounded px-2 py-2 text-left hover:bg-white">{hymn.number ? `${hymn.number} — ` : ""}{hymn.title}{hymn.tuneName ? ` · ${hymn.tuneName}` : ""}</button>)}</div>}
      {editing && <form onSubmit={saveRights} className="mt-4 grid gap-3 rounded-xl border border-ink/10 p-4">
        <p className="font-semibold">{editing.number ? `${editing.number} — ` : ""}{editing.title}</p>
        <div className="grid gap-3 md:grid-cols-3">{(["lyricsRights", "musicRights", "arrangementRights"] as const).map((field) => <label key={field} className="grid gap-1 text-sm font-semibold">{field === "lyricsRights" ? "Lyrics rights" : field === "musicRights" ? "Music rights" : "Arrangement rights"}<select name={field} defaultValue={editing[field]} className="focus-ring rounded-lg border border-ink/15 px-3 py-2"><option value="UNKNOWN">Unknown</option><option value="PUBLIC_DOMAIN">Public domain</option><option value="COPYRIGHTED">Copyrighted</option></select></label>)}</div>
        <label className="grid gap-1 text-sm font-semibold">Public-domain lyrics<textarea name="lyricsText" defaultValue={editing.lyricsText ?? ""} rows={8} className="focus-ring rounded-lg border border-ink/15 px-3 py-2" /></label>
        <div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Music image URL<input name="musicImageUrl" type="url" defaultValue={editing.musicImageUrl ?? ""} className="focus-ring rounded-lg border border-ink/15 px-3 py-2" /></label><label className="grid gap-1 text-sm font-semibold">Music URL<input name="musicUrl" type="url" defaultValue={editing.musicUrl ?? ""} className="focus-ring rounded-lg border border-ink/15 px-3 py-2" /></label></div>
        <label className="grid gap-1 text-sm font-semibold">Rights/source URL<input name="rightsSourceUrl" type="url" defaultValue={editing.rightsSourceUrl ?? ""} className="focus-ring rounded-lg border border-ink/15 px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-semibold">Rights notes<textarea name="rightsNotes" defaultValue={editing.rightsNotes ?? ""} rows={3} className="focus-ring rounded-lg border border-ink/15 px-3 py-2" /></label>
        <button className="focus-ring w-fit rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Save public-domain content</button>
      </form>}
    </div>}
    {message && <p className="mt-4 text-sm font-semibold text-coral">{message}</p>}
  </section>;
}
