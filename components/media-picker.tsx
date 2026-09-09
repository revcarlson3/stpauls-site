"use client";

import { useEffect, useState } from "react";

type MediaAsset = { id: string; originalName: string; url: string; mimeType: string; altText: string | null; title: string | null };

export function MediaPicker({ label = "Add media", value, mediaType = "image", onSelect, onSelectUrl }: { label?: string; value?: string; mediaType?: "image" | "video" | "audio" | "document" | "all"; onSelect: (asset: MediaAsset) => void; onSelectUrl?: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setExternalUrl(value && !value.startsWith("/api/media/upload?file=") ? value : "");
    setLoading(true);
    const query = search.trim() ? `?type=${mediaType}&search=${encodeURIComponent(search.trim())}` : `?type=${mediaType}`;
    void fetch(`/api/media${query}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load media.");
      setAssets(body as MediaAsset[]);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load media.")).finally(() => setLoading(false));
  }, [mediaType, open, search, value]);

  async function upload(file: File) {
    setUploading(true); setError("");
    try {
      const data = new FormData(); data.set("asset", file);
      const response = await fetch("/api/media/upload", { method: "POST", body: data });
      const body = await response.json();
      if (!response.ok || !body.asset) throw new Error(body.error ?? "Unable to upload media.");
      onSelect(body.asset as MediaAsset); setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload media.");
    } finally { setUploading(false); }
  }

  return <>
    <button type="button" className="focus-ring rounded-lg border border-coral px-3 py-2 text-xs font-semibold text-coral hover:bg-coral hover:text-white" onClick={() => setOpen(true)}>{value ? "Change media" : label}</button>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="Media library" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 p-5"><div><h2 className="font-serif text-2xl">Add {mediaType}</h2><p className="text-sm text-ink/55">Choose an existing {mediaType} or upload a new one.</p></div><button type="button" className="focus-ring text-sm font-semibold text-ink/55 hover:text-coral" onClick={() => setOpen(false)}>Close</button></div>
        <div className="grid gap-3 border-b border-ink/10 p-4 sm:grid-cols-[1fr_auto]"><input autoFocus className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink" placeholder={`Search ${mediaType}s`} value={search} onChange={(event) => setSearch(event.target.value)} /><label className="focus-ring inline-flex cursor-pointer items-center justify-center rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white">{uploading ? "Uploading..." : `Upload ${mediaType}`}<input type="file" accept={mediaType === "video" ? "video/mp4,video/webm,video/quicktime" : mediaType === "audio" ? "audio/*" : mediaType === "document" || mediaType === "all" ? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.txt,.csv,.xml,.json,.zip,.rar,.7z,.gz,.odt,.ods,.odp" : "image/png,image/jpeg,image/webp,image/gif"} className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /></label></div>
        {mediaType === "video" && onSelectUrl && <div className="grid gap-2 border-b border-ink/10 bg-ink/[.025] p-4"><label className="text-xs font-semibold uppercase tracking-wider text-ink/55">Use an external video URL</label><div className="flex flex-col gap-2 sm:flex-row"><input className="focus-ring min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink" type="url" placeholder="https://cdn.example.com/video.mp4" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} /><button type="button" className="focus-ring rounded-lg border border-coral px-4 py-2 text-sm font-semibold text-coral hover:bg-coral hover:text-white" disabled={!externalUrl.trim()} onClick={() => { onSelectUrl(externalUrl.trim()); setOpen(false); }}>Use URL</button></div><p className="text-xs text-ink/50">Use a direct MP4, WebM, or MOV URL from your CDN or video host.</p></div>}
        {error && <p role="alert" className="px-4 pt-3 text-sm text-coral">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{loading ? <p className="p-6 text-center text-sm text-ink/55">Loading media...</p> : assets.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{assets.map((asset) => <button key={asset.id} type="button" className="focus-ring overflow-hidden rounded-xl border border-ink/10 text-left hover:border-coral" onClick={() => { onSelect(asset); setOpen(false); }}>{mediaType === "video" ? <video src={asset.url} muted className="aspect-square w-full object-cover" /> : asset.mimeType.startsWith("image/") ? <img src={asset.url} alt={asset.altText ?? asset.title ?? asset.originalName} className="aspect-square w-full object-cover" /> : <span className="flex aspect-square items-center justify-center bg-mist/50 p-3 text-center text-xs font-semibold text-ink/60">{asset.originalName}</span>}<span className="block truncate p-2 text-xs font-semibold text-ink">{asset.title || asset.originalName}</span></button>)}</div> : <p className="p-6 text-center text-sm text-ink/55">No {mediaType}s found. Upload one to get started.</p>}</div>
      </div>
    </div>}
  </>;
}
