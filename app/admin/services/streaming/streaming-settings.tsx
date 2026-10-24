"use client";

import { useEffect, useState } from "react";

const DESTINATIONS = [
  { id: "YOUTUBE", name: "YouTube Live", description: "Broad reach and strong support for OAuth-based scheduled broadcasts." },
  { id: "FACEBOOK", name: "Facebook Live", description: "Reach church pages and communities through Meta’s page publishing tools." },
  { id: "VIMEO", name: "Vimeo", description: "Professional and private event streaming for organizations with eligible plans." },
  { id: "TWITCH", name: "Twitch", description: "Interactive live channel support for outreach and younger audiences." },
  { id: "LINKEDIN", name: "LinkedIn Live", description: "Professional broadcasts, subject to LinkedIn approval and access requirements." },
  { id: "RESTREAM", name: "Restream", description: "A multistream hub that can distribute one production to several destinations." },
] as const;

export function StreamingSettings() {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/services/settings").then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to load streaming settings.");
      setSelected(Array.isArray(body.streamingDestinations) ? body.streamingDestinations : []);
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load streaming settings.")).finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/services/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ streamingDestinations: selected }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Streaming destinations saved." : body.error ?? "Unable to save streaming destinations.");
    setSaving(false);
  }

  return <section className="mt-8 grid gap-8">
    <section className="rounded-[var(--site-radius-card)] border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Livestream destinations</h2>
      <p className="mt-2 max-w-3xl text-sm text-ink/60">Select every platform where this church may schedule a livestream. The website will not carry the video stream; later steps will connect approved provider APIs and create broadcasts for vMix or OBS to send to.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {DESTINATIONS.map((destination) => <label key={destination.id} className="flex gap-3 rounded-xl border border-ink/10 p-4">
          <input type="checkbox" checked={selected.includes(destination.id)} onChange={() => toggle(destination.id)} disabled={loading || saving} className="mt-1" />
          <span><strong className="block">{destination.name}</strong><span className="mt-1 block text-sm text-ink/60">{destination.description}</span></span>
        </label>)}
      </div>
      <button type="button" disabled={loading || saving} onClick={() => void save()} className="focus-ring mt-5 rounded-full bg-coral px-5 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save destinations"}</button>
      {message && <p role="alert" className="mt-4 text-sm font-semibold text-coral">{message}</p>}
    </section>
    <section className="rounded-[var(--site-radius-card)] border border-dashed border-ink/20 bg-white/60 p-6">
      <h2 className="font-serif text-2xl">Provider setup</h2>
      <p className="mt-2 text-sm text-ink/60">After destinations are selected, the next step is to document account creation, OAuth/API setup, permissions, and provider-specific scheduling limits. No provider credentials are requested or stored yet.</p>
    </section>
  </section>;
}
