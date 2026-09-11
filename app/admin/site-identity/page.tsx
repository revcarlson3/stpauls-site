"use client";

import { useEffect, useState } from "react";
import { Button, Container, Notification } from "@/components/ui";

export default function SiteIdentityPage() {
  const [settings, setSettings] = useState({ siteName: "St. Paul's", siteUrl: "", siteTagline: "A place to belong.", siteLogoUrl: "", siteLogoLightUrl: "", siteLogoDarkUrl: "", siteFaviconUrl: "", siteShowTitle: true, siteShowTagline: true, siteShowLogo: false });
  const [previewUrls, setPreviewUrls] = useState({ light: "", dark: "", favicon: "" });
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "danger">("success");

  useEffect(() => {
    void fetch("/api/site-identity").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load site identity.");
      setSettings(await response.json());
    }).catch((error: Error) => { setMessageVariant("danger"); setMessage(error.message); });
  }, []);

  async function save() {
    const response = await fetch("/api/site-identity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setMessageVariant(response.ok ? "success" : "danger");
    setMessage(response.ok ? "Site identity saved." : "Unable to save site identity.");
    if (response.ok) window.dispatchEvent(new Event("site-settings-updated"));
  }

  async function upload(kind: "logo-light" | "logo-dark" | "favicon", file: File | null) {
    if (!file) return;
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("asset", file);
    const response = await fetch("/api/site-identity", { method: "POST", body: formData });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) { setMessageVariant("danger"); setMessage(value.error ?? "Unable to upload asset."); return; }
    setSettings((current) => ({ ...current, [kind === "logo-light" ? "siteLogoLightUrl" : kind === "logo-dark" ? "siteLogoDarkUrl" : "siteFaviconUrl"]: value.url }));
    setPreviewUrls((current) => ({ ...current, [kind === "logo-light" ? "light" : kind === "logo-dark" ? "dark" : "favicon"]: URL.createObjectURL(file) }));
    setMessageVariant("success");
    setMessage(`${kind === "favicon" ? "Favicon" : kind === "logo-dark" ? "Dark logo" : "Light logo"} uploaded. Save identity to publish it.`);
  }

  async function remove(kind: "logo-light" | "logo-dark" | "favicon") {
    const response = await fetch("/api/site-identity", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) { setMessageVariant("danger"); setMessage(value.error ?? "Unable to remove asset."); return; }
    setSettings((current) => ({ ...current, [kind === "logo-light" ? "siteLogoLightUrl" : kind === "logo-dark" ? "siteLogoDarkUrl" : "siteFaviconUrl"]: "" }));
    setPreviewUrls((current) => ({ ...current, [kind === "logo-light" ? "light" : kind === "logo-dark" ? "dark" : "favicon"]: "" }));
    setMessageVariant("success");
    setMessage(`${kind === "favicon" ? "Favicon" : kind === "logo-dark" ? "Dark logo" : "Light logo"} removed.`);
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site Settings</p>
        <h1 className="mt-2 font-serif text-4xl">Site Identity</h1>
        <p className="mt-3 max-w-2xl text-ink/60">Control the name, address, supporting line, and identity elements shown across the public site.</p>
        <section className="mt-8 grid max-w-2xl gap-5 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
          <label className="grid gap-1 text-sm font-semibold">Site name<input required value={settings.siteName} onChange={(event) => setSettings({ ...settings, siteName: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold">Site URL<input type="url" placeholder="https://example.org" value={settings.siteUrl} onChange={(event) => setSettings({ ...settings, siteUrl: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold">Tagline or subtitle<input value={settings.siteTagline} onChange={(event) => setSettings({ ...settings, siteTagline: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          <div className="grid gap-2">
            <label className="grid gap-1 text-sm font-semibold">Light-background logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { const file = event.target.files?.[0] ?? null; void upload("logo-light", file); }} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            {(previewUrls.light || settings.siteLogoLightUrl) && <div className="flex items-center gap-3"><img src={previewUrls.light || settings.siteLogoLightUrl} alt="Current light-background logo" className="h-12 max-w-48 rounded border border-ink/10 bg-white object-contain p-1" /><button type="button" onClick={() => void remove("logo-light")} className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-xs font-semibold text-ink/70">Remove logo</button></div>}
            <label className="grid gap-1 text-sm font-semibold">Dark-background logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { const file = event.target.files?.[0] ?? null; void upload("logo-dark", file); }} className="focus-ring rounded-lg border border-ink/15 bg-ink px-3 py-2 font-normal text-white" /></label>
            {(previewUrls.dark || settings.siteLogoDarkUrl) && <div className="flex items-center gap-3"><img src={previewUrls.dark || settings.siteLogoDarkUrl} alt="Current dark-background logo" className="h-12 max-w-48 rounded border border-ink/10 bg-ink object-contain p-1" /><button type="button" onClick={() => void remove("logo-dark")} className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-xs font-semibold text-ink/70">Remove logo</button></div>}
          </div>
          <div className="grid gap-2">
            <label className="grid gap-1 text-sm font-semibold">Favicon upload<input type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml" onChange={(event) => { const file = event.target.files?.[0] ?? null; void upload("favicon", file); }} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            {(previewUrls.favicon || settings.siteFaviconUrl) && <div className="flex items-center gap-3"><img src={previewUrls.favicon || settings.siteFaviconUrl} alt="Current favicon" className="h-12 w-12 rounded border border-ink/10 bg-white object-contain p-1" /><button type="button" onClick={() => void remove("favicon")} className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-xs font-semibold text-ink/70">Remove favicon</button></div>}
          </div>
          <fieldset className="grid gap-3 border-t border-ink/10 pt-5">
            <legend className="text-sm font-semibold">Display options</legend>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.siteShowLogo} onChange={(event) => setSettings({ ...settings, siteShowLogo: event.target.checked })} /> Show logo in the header</label>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.siteShowTitle} onChange={(event) => setSettings({ ...settings, siteShowTitle: event.target.checked })} /> Show site name</label>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.siteShowTagline} onChange={(event) => setSettings({ ...settings, siteShowTagline: event.target.checked })} /> Show tagline or subtitle</label>
          </fieldset>
          <div className="flex items-center gap-4"><Button type="button" onClick={() => void save()}>Save identity</Button>{message && <Notification variant={messageVariant}>{message}</Notification>}</div>
        </section>
      </Container>
    </main>
  );
}
