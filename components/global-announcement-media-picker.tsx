"use client";

import { useState } from "react";

export function GlobalAnnouncementMediaPicker({ onInsert }: { onInsert: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("asset", file);
      const response = await fetch("/api/global-admin/announcement-assets", { method: "POST", body: form });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to upload announcement image.");
      onInsert(value.asset.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload announcement image.");
    } finally { setBusy(false); }
  }
  return <span className="inline-flex items-center gap-2"><label className="focus-ring inline-flex h-7 cursor-pointer items-center rounded px-2 text-xs font-semibold hover:bg-mist"><span>{busy ? "Uploading..." : "Insert global image"}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /></label>{error && <span role="alert" className="text-xs text-coral">{error}</span>}</span>;
}
