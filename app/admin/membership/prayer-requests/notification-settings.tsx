"use client";

import { useEffect, useState } from "react";

export function PrayerNotificationSettings() {
  const [sundayEmail, setSundayEmail] = useState("");
  const [eldersEmail, setEldersEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/membership/prayer-requests/settings").then(async (response) => {
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error ?? "Unable to load notification settings.");
      setSundayEmail(value.sundayEmail ?? "");
      setEldersEmail(value.eldersEmail ?? "");
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/membership/prayer-requests/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sundayEmail, eldersEmail })
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error ?? "Unable to save notification settings.");
      setSundayEmail(value.sundayEmail ?? "");
      setEldersEmail(value.eldersEmail ?? "");
      setMessage("Notification addresses saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save notification settings.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={(event) => void save(event)} className="grid gap-4">
    <p className="text-sm leading-6 text-ink/60">These messages use the site email provider and SMTP settings configured by the administrator.</p>
    <label className="grid gap-1 text-sm font-semibold">Sunday morning prayers<input type="email" value={sundayEmail} onChange={(event) => setSundayEmail(event.target.value)} placeholder="prayers@example.org" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
    <label className="grid gap-1 text-sm font-semibold">Pastor or elder contact<input type="email" value={eldersEmail} onChange={(event) => setEldersEmail(event.target.value)} placeholder="elders@example.org" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
    <button type="submit" disabled={busy} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save addresses"}</button>
    {message && <p role="status" className="text-sm text-ink/70">{message}</p>}
  </form>;
}
