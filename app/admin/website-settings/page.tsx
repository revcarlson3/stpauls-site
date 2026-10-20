"use client";

import { useEffect, useState } from "react";
import { Container, Notification } from "@/components/ui";
import { MediaPicker } from "@/components/media-picker";

export default function WebsiteSettingsPage() {
  const [faviconUrl, setFaviconUrl] = useState("");
  const [faviconConfigured, setFaviconConfigured] = useState(false);
  const [defaultFavicon, setDefaultFavicon] = useState("");
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "danger">("success");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/site-identity").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load website settings.");
      const value = await response.json() as { siteFaviconUrl?: string; siteFaviconConfigured?: boolean };
      setFaviconUrl(value.siteFaviconUrl ?? "");
      setFaviconConfigured(value.siteFaviconConfigured === true);
      setDefaultFavicon("/mychurch-one-favicon.svg");
    }).catch((error: Error) => { setMessageVariant("danger"); setMessage(error.message); });
  }, []);

  async function save(nextValue = faviconUrl) {
    setSaving(true);
    const response = await fetch("/api/site-identity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteFaviconUrl: nextValue }) });
    setMessageVariant(response.ok ? "success" : "danger");
    setMessage(response.ok ? "Favicon saved." : "Unable to save favicon.");
    setSaving(false);
  }

  return <main><Container className="py-10 sm:py-14">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Public Website</p>
    <h1 className="mt-2 font-serif text-4xl">Website Settings</h1>
    <p className="mt-3 max-w-2xl text-ink/60">Manage public website behavior and presentation settings. More website controls will be added here over time.</p>
    <section className="mt-8 grid max-w-3xl gap-5 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
      <div><h2 className="font-serif text-2xl">Favicon</h2><p className="mt-2 text-sm text-ink/60">Choose an image from the Media Library or upload a new one. Square PNG, SVG, WebP, GIF, or ICO images work best.</p></div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-ink/10 bg-white p-2"><img src={faviconUrl || defaultFavicon} alt="Current favicon preview" className="h-full w-full object-contain" /></div>
        <div className="grid gap-2"><MediaPicker label="Choose favicon image" value={faviconConfigured ? faviconUrl : ""} permission="MANAGE_SETTINGS" onSelect={(asset) => { setFaviconUrl(asset.url); setFaviconConfigured(true); void save(asset.url); }} /><button type="button" disabled={saving || !faviconConfigured} onClick={() => { setFaviconUrl(""); setFaviconConfigured(false); void save(""); }} className="focus-ring text-left text-xs font-semibold text-coral hover:underline disabled:cursor-not-allowed disabled:opacity-40">Use default favicon</button></div>
      </div>
      {message && <Notification variant={messageVariant}>{message}</Notification>}
    </section>
  </Container></main>;
}
