"use client";

import { useEffect, useState } from "react";
import { Container, Notification } from "@/components/ui";
import { MediaPicker } from "@/components/media-picker";

export default function WebsiteSettingsPage() {
  const [faviconUrl, setFaviconUrl] = useState("");
  const [faviconConfigured, setFaviconConfigured] = useState(false);
  const [defaultFavicon, setDefaultFavicon] = useState("");
  const [publicSiteEnabled, setPublicSiteEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [canManageModules, setCanManageModules] = useState(false);
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "danger">("success");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([fetch("/api/site-identity"), fetch("/api/site-settings/website")]).then(async ([identityResponse, websiteResponse]) => {
      if (!identityResponse.ok || !websiteResponse.ok) throw new Error("Unable to load website settings.");
      const value = await identityResponse.json() as { siteFaviconUrl?: string; siteFaviconConfigured?: boolean };
      const website = await websiteResponse.json() as { publicSiteEnabled?: boolean; maintenanceMode?: boolean; canManageModules?: boolean };
      setFaviconUrl(value.siteFaviconUrl ?? "");
      setFaviconConfigured(value.siteFaviconConfigured === true);
      setDefaultFavicon("/mychurch-one-favicon.svg");
      setPublicSiteEnabled(website.publicSiteEnabled !== false);
      setMaintenanceMode(website.maintenanceMode === true);
      setCanManageModules(website.canManageModules === true);
    }).catch((error: Error) => { setMessageVariant("danger"); setMessage(error.message); });
  }, []);

  async function save(nextValue = faviconUrl) {
    setSaving(true);
    const response = await fetch("/api/site-identity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteFaviconUrl: nextValue }) });
    setMessageVariant(response.ok ? "success" : "danger");
    setMessage(response.ok ? "Favicon saved." : "Unable to save favicon.");
    setSaving(false);
  }

  async function saveWebsiteSettings(nextPublicSiteEnabled: boolean, nextMaintenanceMode: boolean) {
    const response = await fetch("/api/site-settings/website", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicSiteEnabled: nextPublicSiteEnabled, maintenanceMode: nextMaintenanceMode }) });
    setMessageVariant(response.ok ? "success" : "danger");
    setMessage(response.ok ? "Website settings saved." : "Unable to save website settings.");
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
    {canManageModules && <section className="mt-6 grid max-w-3xl gap-3 rounded-2xl border border-coral/25 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Public website</h2>
      <p className="text-sm text-ink/60">Turn the public-facing church website on or off. When disabled, visitors are sent to the administrator sign-in page and site-building tools are hidden from the admin menu.</p>
      <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={publicSiteEnabled} onChange={(event) => { const value = event.target.checked; setPublicSiteEnabled(value); void saveWebsiteSettings(value, value ? maintenanceMode : false); }} /> Enable public website</label>
      {publicSiteEnabled && <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={maintenanceMode} onChange={(event) => { const value = event.target.checked; setMaintenanceMode(value); void saveWebsiteSettings(publicSiteEnabled, value); }} /> Enable maintenance mode</label>}
      {publicSiteEnabled && maintenanceMode && <p className="text-xs text-ink/60">Visitors will see the maintenance page until this switch is turned off. Administrator login remains available.</p>}
    </section>}
  </Container></main>;
}
