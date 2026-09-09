"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cropper, type CropperRef } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import { Button, Card, Container, Notification } from "@/components/ui";

type MediaType = "all" | "image" | "video" | "audio" | "document" | "other";

type MediaAsset = {
  id: string;
  originalName: string;
  storedFilename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  folder: string;
  width: number | null;
  height: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  mediaType: Exclude<MediaType, "all">;
  uploader: { id: string; name: string; email: string } | null;
  linkedPages: { id: string; title: string; slug: string }[];
};

type MediaFolder = { name: string; count: number };

const acceptedFiles = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const typeOptions: { value: MediaType; label: string }[] = [
  { value: "all", label: "All files" },
  { value: "image", label: "Images" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Documents" },
  { value: "other", label: "Other" }
];

export function MediaLibrary() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [sourceFolder, setSourceFolder] = useState("");
  const [destinationFolder, setDestinationFolder] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<MediaType>("all");
  const [generated, setGenerated] = useState<"all" | "generated" | "standard">("all");
  const [linked, setLinked] = useState<"all" | "linked" | "unlinked">("all");
  const [folder, setFolder] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkFolder, setBulkFolder] = useState("");
  const [assetFolder, setAssetFolder] = useState("");
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [backfillingMetadata, setBackfillingMetadata] = useState(false);
  const [mergingFolders, setMergingFolders] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSize, setAiSize] = useState("landscape");
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "danger" | "info">("info");
  const [editorOpen, setEditorOpen] = useState(false);

  const loadAssets = useCallback(async (preferredId?: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (type !== "all") params.set("type", type);
      if (linked !== "all") params.set("linked", linked);
      if (generated !== "all") params.set("generated", generated);
      if (folder) params.set("folder", folder);
      const response = await fetch(`/api/media${params.size ? `?${params.toString()}` : ""}`);
      const body = await response.json().catch(() => []);
      if (!response.ok) throw new Error(body.error ?? "Unable to load media.");
      setAssets(body);
      if (preferredId) setSelectedId(preferredId);
    } catch (error) {
      setMessageVariant("danger");
      setMessage(error instanceof Error ? error.message : "Unable to load media.");
    } finally {
      setLoading(false);
    }
  }, [search, type, linked, generated, folder]);

  const loadFolders = useCallback(async () => {
    try {
      const response = await fetch("/api/media/folders");
      const body = await response.json().catch(() => []);
      if (!response.ok) throw new Error(body.error ?? "Unable to load folders.");
      setFolders(body);
    } catch (error) {
      setMessageVariant("danger");
      setMessage(error instanceof Error ? error.message : "Unable to load folders.");
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => { void loadAssets(); }, 150);
    return () => window.clearTimeout(handle);
  }, [loadAssets]);

  useEffect(() => { void loadFolders(); }, [loadFolders]);

  useEffect(() => {
    if (!assets.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !assets.some((asset) => asset.id === selectedId)) setSelectedId(assets[0].id);
  }, [assets, selectedId]);

  useEffect(() => {
    setSelectedIds((current) => new Set(Array.from(current).filter((id) => assets.some((asset) => asset.id === id))));
  }, [assets]);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === selectedId) ?? null, [assets, selectedId]);
  const reusableUrl = selectedAsset ? new URL(selectedAsset.url, window.location.origin).href : "";

  useEffect(() => {
    setTitle(selectedAsset?.title ?? "");
    setAltText(selectedAsset?.altText ?? "");
    setCaption(selectedAsset?.caption ?? "");
    setDescription(selectedAsset?.description ?? "");
    setTagsText((selectedAsset?.tags ?? []).join(", "));
    setAssetFolder(selectedAsset?.folder ?? "");
  }, [selectedAsset]);

  const metadataDirty = !!selectedAsset && (
    title !== (selectedAsset.title ?? "") ||
    altText !== (selectedAsset.altText ?? "") ||
    caption !== (selectedAsset.caption ?? "") ||
    description !== (selectedAsset.description ?? "") ||
    tagsText !== selectedAsset.tags.join(", ")
  );

  async function uploadFiles(files: FileList | File[]) {
    const queue = Array.from(files).filter((file) => file.size > 0);
    if (!queue.length) return;
    setUploading(true);
    let uploaded = 0;
    let firstUploadedId: string | null = null;
    try {
      for (const file of queue) {
        const formData = new FormData();
        formData.set("asset", file);
        const response = await fetch("/api/media/upload", { method: "POST", body: formData });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.asset) throw new Error(body.error ?? `Unable to upload ${file.name}.`);
        uploaded += 1;
        firstUploadedId = firstUploadedId ?? body.asset.id;
      }

      setMessageVariant("success");
      setMessage(uploaded === 1 ? "1 file uploaded to the Media Library." : `${uploaded} files uploaded to the Media Library.`);
      await loadAssets(firstUploadedId);
      await loadFolders();
    } catch (error) {
      setMessageVariant("danger");
      setMessage(error instanceof Error ? error.message : "Unable to upload file.");
    } finally {
      setUploading(false);
      setDragging(false);
    }
  }

  async function generateImage() {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    setGenerating(true);
    try {
      const response = await fetch("/api/media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: aiSize })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.asset) throw new Error(body.error ?? "Unable to generate an image.");
      setAiPrompt("");
      setMessageVariant("success");
      setMessage("AI image generated and saved to the Media Library.");
      await loadAssets(body.asset.id);
    } catch (error) {
      setMessageVariant("danger");
      setMessage(error instanceof Error ? error.message : "Unable to generate an image.");
    } finally {
      setGenerating(false);
    }
  }

  async function backfillMetadata() {
    setBackfillingMetadata(true);
    try {
      const response = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backfill-metadata" })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to scan existing media.");
      setMessageVariant("success");
      setMessage(`Metadata scan complete: updated ${body.updated} of ${body.scanned} eligible images.`);
      await loadAssets(selectedId);
    } catch (error) {
      setMessageVariant("danger");
      setMessage(error instanceof Error ? error.message : "Unable to scan existing media.");
    } finally {
      setBackfillingMetadata(false);
    }
  }

  async function mergeFolders() {
    if (!sourceFolder || !destinationFolder || sourceFolder === destinationFolder) return;
    if (!window.confirm(`Move every asset from "${sourceFolder}" into "${destinationFolder}"? The empty source folder will no longer appear.`)) return;
    setMergingFolders(true);
    try {
      const response = await fetch("/api/media/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: sourceFolder, to: destinationFolder })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to merge folders.");
      setMessageVariant("success");
      setMessage(`${body.moved} asset${body.moved === 1 ? "" : "s"} moved from ${body.from} to ${body.to}.`);
      if (folder === sourceFolder) setFolder(destinationFolder);
      setSourceFolder("");
      setDestinationFolder("");
      await Promise.all([loadAssets(), loadFolders()]);
    } catch (error) {
      setMessageVariant("danger");
      setMessage(error instanceof Error ? error.message : "Unable to merge folders.");
    } finally {
      setMergingFolders(false);
    }
  }

  async function saveMetadata() {
    if (!selectedAsset) return;
    const response = await fetch(`/api/media/${selectedAsset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        altText,
        caption,
        description,
        tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean)
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessageVariant("danger");
      setMessage(body.error ?? "Unable to save media details.");
      return;
    }
    setAssets((current) => current.map((asset) => asset.id === body.id ? body : asset));
    setMessageVariant("success");
    setMessage("Media details saved.");
  }

  async function copyUrl() {
    if (!reusableUrl) return;
    try {
      await navigator.clipboard.writeText(reusableUrl);
      setMessageVariant("info");
      setMessage("Media URL copied.");
    } catch {
      setMessageVariant("danger");
      setMessage("Unable to copy the media URL.");
    }
  }

  async function saveEditedImage(edit: ImageEditValues) {
    if (!selectedAsset) return;
    setEditorOpen(false);
    const response = await fetch(`/api/media/${selectedAsset.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.id) {
      setMessageVariant("danger");
      setMessage(body.error ?? "Unable to create the edited image.");
      return;
    }
    setMessageVariant("success");
    setMessage("Edited image added as a new media asset. The original was preserved.");
    await loadAssets(body.id);
  }

  async function removeSelected() {
    if (!selectedAsset || !window.confirm(`Delete ${selectedAsset.originalName}?`)) return;
    const response = await fetch(`/api/media/${selectedAsset.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessageVariant("danger");
      setMessage(body.error ?? "Unable to delete media.");
      return;
    }
    const remaining = assets.filter((asset) => asset.id !== selectedAsset.id);
    setAssets(remaining);
    setSelectedId(remaining[0]?.id ?? null);
    setMessageVariant("success");
    setMessage("Media asset deleted.");
  }

  function toggleBulkSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function removeSelectedBulk() {
    if (!selectedIds.size || !window.confirm(`Delete ${selectedIds.size} selected media assets? Linked assets will be protected.`)) return;
    const results = await Promise.all(Array.from(selectedIds).map(async (id) => {
      const response = await fetch(`/api/media/${id}`, { method: "DELETE" });
      return { id, ok: response.ok, body: await response.json().catch(() => ({})) };
    }));
    const deleted = new Set(results.filter((result) => result.ok).map((result) => result.id));
    const blocked = results.filter((result) => !result.ok).length;
    setAssets((current) => current.filter((asset) => !deleted.has(asset.id)));
    setSelectedIds(new Set());
    if (blocked) {
      setMessageVariant("info");
      setMessage(`${deleted.size} asset${deleted.size === 1 ? "" : "s"} deleted. ${blocked} could not be deleted, likely because it is linked to a page.`);
    } else {
      setMessageVariant("success");
      setMessage(`${deleted.size} media assets deleted.`);
    }
  }

  async function moveSelectedBulk() {
    const destination = bulkFolder.trim();
    if (!selectedIds.size || !destination) return;
    if (!window.confirm(`Move ${selectedIds.size} selected media assets to "${destination}"?`)) return;
    const results = await Promise.all(Array.from(selectedIds).map(async (id) => {
      const response = await fetch(`/api/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: destination })
      });
      return { id, ok: response.ok };
    }));
    const moved = new Set(results.filter((result) => result.ok).map((result) => result.id));
    const failed = results.length - moved.size;
    setBulkFolder("");
    setSelectedIds(new Set());
    setMessageVariant(failed ? "info" : "success");
    setMessage(`${moved.size} asset${moved.size === 1 ? "" : "s"} moved to ${destination}.${failed ? ` ${failed} could not be moved.` : ""}`);
    await Promise.all([loadAssets(), loadFolders()]);
  }

  async function moveSelectedAsset() {
    if (!selectedAsset || !assetFolder.trim()) return;
    const destination = assetFolder.trim();
    const response = await fetch(`/api/media/${selectedAsset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: destination })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessageVariant("danger");
      setMessage(body.error ?? "Unable to move media asset.");
      return;
    }
    setMessageVariant("success");
    setMessage(`Media asset moved to ${destination}.`);
    await Promise.all([loadAssets(), loadFolders()]);
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Content</p>
            <h1 className="mt-2 font-serif text-4xl">Media Library</h1>
            <p className="mt-2 max-w-3xl text-ink/60">Upload once, reuse everywhere, and keep image details organized for the page editor and future asset pickers.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-ink/10 bg-white p-1 shadow-sm">
            <button type="button" className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${viewMode === "grid" ? "bg-coral text-white" : "text-ink/70"}`} onClick={() => setViewMode("grid")}>Grid</button>
            <button type="button" className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${viewMode === "list" ? "bg-coral text-white" : "text-ink/70"}`} onClick={() => setViewMode("list")}>List</button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-6">
            <Card
              className={`border-dashed p-6 transition-colors ${dragging ? "border-coral bg-coral/5" : "border-ink/15"}`}
              onDragOver={(event) => { event.preventDefault(); if (!dragging) setDragging(true); }}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
              onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadFiles(event.dataTransfer.files); }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-serif text-2xl">Upload media</h2>
                  <p className="mt-2 text-sm text-ink/60">Drag images here or browse files. Uploads keep the existing `/api/media/upload` URL pattern for page content compatibility.</p>
                </div>
                <label className="focus-ring inline-flex cursor-pointer items-center justify-center rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white shadow-sm">
                  <span>{uploading ? "Uploading..." : "Choose files"}</span>
                  <input type="file" accept={acceptedFiles} multiple className="sr-only" disabled={uploading} onChange={(event) => { const files = event.target.files; if (files?.length) void uploadFiles(files); event.currentTarget.value = ""; }} />
                </label>
              </div>
              <p className="mt-3 text-xs text-ink/50">PNG, JPG, WebP, GIF, MP4, WebM, and MOV up to 100 MB each.</p>
            </Card>

            <Card className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-2xl">Create an AI image</h2>
                  <p className="mt-2 text-sm text-ink/60">Describe the image you need. The result is saved as page media and can be edited, captioned, organized, and reused like any uploaded image.</p>
                  <textarea className="focus-ring mt-4 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink" rows={3} maxLength={500} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Example: A warm, welcoming stained-glass church window at sunrise, no text" />
                  <p className="mt-2 text-xs text-ink/50">Your prompt is sent to Pollinations.AI to create the image. Review generated images before publishing.</p>
                </div>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                  Shape
                  <select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={aiSize} onChange={(event) => setAiSize(event.target.value)}>
                    <option value="landscape">Landscape (16:9)</option>
                    <option value="square">Square (1:1)</option>
                    <option value="portrait">Portrait (9:16)</option>
                  </select>
                </label>
                <Button type="button" className="px-5 py-3" disabled={generating || !aiPrompt.trim()} onClick={() => void generateImage()}>{generating ? "Generating..." : "Generate image"}</Button>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                    Search media
                    <input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search filename, title, alt text, or tag" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                    Linked
                    <select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={linked} onChange={(event) => setLinked(event.target.value as typeof linked)}>
                      <option value="all">All assets</option><option value="linked">Used on pages</option><option value="unlinked">Not linked</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                    Source
                    <select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={generated} onChange={(event) => setGenerated(event.target.value as typeof generated)}>
                      <option value="all">All sources</option><option value="generated">AI generated</option><option value="standard">Uploaded or edited</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                    Folder
                    <input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={folder} onChange={(event) => setFolder(event.target.value)} placeholder="YYYY-MM" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                    Type
                    <select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={type} onChange={(event) => setType(event.target.value as MediaType)}>
                      {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-ink/55">{loading ? "Loading…" : `${assets.length} ${assets.length === 1 ? "asset" : "assets"}`}</p>
                  {!loading && assets.length > 0 && <button type="button" className="focus-ring text-xs font-semibold text-ink/60 underline" onClick={() => setSelectedIds(selectedIds.size === assets.length ? new Set() : new Set(assets.map((asset) => asset.id)))}>{selectedIds.size === assets.length ? "Clear selection" : "Select all"}</button>}
                  {selectedIds.size > 0 && <div className="flex flex-wrap items-center gap-2">
                    <select className="focus-ring w-40 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink" value={bulkFolder} onChange={(event) => setBulkFolder(event.target.value)} aria-label="Destination folder">
                      <option value="">Choose folder</option>
                      {folders.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                    </select>
                    <button type="button" className="focus-ring rounded-full border border-ink/30 px-3 py-1.5 text-xs font-semibold text-ink" disabled={!bulkFolder.trim()} onClick={() => void moveSelectedBulk()}>Move</button>
                    <button type="button" className="focus-ring rounded-full border border-coral px-3 py-1.5 text-xs font-semibold text-coral" onClick={() => void removeSelectedBulk()}>Delete {selectedIds.size}</button>
                  </div>}
                </div>
                <div className="mt-4 border-t border-ink/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/55">Browse folders</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${!folder ? "border-coral bg-coral text-white" : "border-ink/15 text-ink/70"}`} onClick={() => setFolder("")}>All folders</button>
                    {folders.map((item) => <button key={item.name} type="button" className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${folder === item.name ? "border-coral bg-coral text-white" : "border-ink/15 text-ink/70 hover:border-coral"}`} onClick={() => setFolder(item.name)}>{item.name} <span className="opacity-70">({item.count})</span></button>)}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-4 lg:flex-row lg:items-end">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink/55">Manage folders</p>
                      <p className="mt-1 text-sm text-ink/60">{folders.length > 1 ? "Merge a folder into another existing folder. Empty folders disappear automatically." : "A second folder will appear after media is moved or uploaded in another month; then folders can be merged here."}</p>
                    </div>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Move from<select className="focus-ring min-w-36 rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={sourceFolder} onChange={(event) => setSourceFolder(event.target.value)}><option value="">Choose folder</option>{folders.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}</select></label>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Into<select className="focus-ring min-w-36 rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={destinationFolder} onChange={(event) => setDestinationFolder(event.target.value)}><option value="">Choose folder</option>{folders.filter((item) => item.name !== sourceFolder).map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}</select></label>
                    <button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50" disabled={mergingFolders || !sourceFolder || !destinationFolder || sourceFolder === destinationFolder} onClick={() => void mergeFolders()}>{mergingFolders ? "Merging..." : "Merge folders"}</button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
                    <p className="text-sm text-ink/60">Scan older images to add missing embedded captions and attribution without replacing existing details.</p>
                    <button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50" disabled={backfillingMetadata} onClick={() => void backfillMetadata()}>{backfillingMetadata ? "Scanning..." : "Scan existing metadata"}</button>
                  </div>
                </div>
              </div>

              {message && <div className="mt-4"><Notification variant={messageVariant}>{message}</Notification></div>}

              {loading ? (
                <div className="mt-6 rounded-2xl border border-ink/10 bg-sand/50 p-8 text-center text-sm text-ink/55">Loading media…</div>
              ) : assets.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-ink/10 bg-sand/50 p-8 text-center text-sm text-ink/55">No media matches this search yet.</div>
              ) : viewMode === "grid" ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {assets.map((asset) => <div key={asset.id} className="relative"><label className="absolute left-3 top-3 z-10 rounded-full bg-white/95 p-1.5 shadow-sm"><input type="checkbox" className="h-5 w-5 accent-coral" aria-label={`Select ${asset.originalName}`} checked={selectedIds.has(asset.id)} onChange={() => toggleBulkSelection(asset.id)} /></label><button type="button" className={`focus-ring w-full text-left ${selectedId === asset.id ? "rounded-[var(--site-radius-card)] ring-2 ring-coral/40" : ""}`} onClick={() => setSelectedId(asset.id)}>
                    <Card className={`h-full overflow-hidden transition-colors ${selectedId === asset.id ? "border-coral/40 bg-coral/5" : ""}`}>
                      <MediaThumbnail asset={asset} className="aspect-[4/3] w-full border-b border-ink/10 bg-mist/60" />
                      <div className="grid gap-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="line-clamp-1 text-sm font-semibold text-ink">{asset.title || asset.originalName}</h3>
                            <p className="mt-1 line-clamp-1 text-xs text-ink/50">{asset.originalName}</p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1"><span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/50 shadow-sm">{asset.mediaType}</span>{asset.tags.includes("ai-generated") && <span className="rounded-full bg-coral/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-coral">AI</span>}</div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-ink/50">
                          <span>{asset.folder} · {formatBytes(asset.sizeBytes)}</span>
                          <span>{formatDate(asset.createdAt)}</span>
                        </div>
                      </div>
                    </Card>
                  </button></div>)}
                </div>
              ) : (
                <div className="mt-6 overflow-hidden rounded-2xl border border-ink/10">
                  {assets.map((asset) => <div key={asset.id} className="relative"><label className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 p-1.5 shadow-sm"><input type="checkbox" className="h-5 w-5 accent-coral" aria-label={`Select ${asset.originalName}`} checked={selectedIds.has(asset.id)} onChange={() => toggleBulkSelection(asset.id)} /></label><button type="button" className={`focus-ring grid w-full grid-cols-[72px_minmax(0,1fr)] items-center gap-4 border-b border-ink/10 bg-white p-4 pl-14 text-left transition-colors last:border-b-0 ${selectedId === asset.id ? "bg-coral/5" : "hover:bg-sand/40"}`} onClick={() => setSelectedId(asset.id)}>
                    <MediaThumbnail asset={asset} className="h-[72px] w-[72px] overflow-hidden rounded-xl border border-ink/10 bg-mist/60" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-ink">{asset.title || asset.originalName}</h3>
                        <p className="truncate text-xs text-ink/50">{asset.originalName} · {asset.mimeType}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink/50">
                        <span>{asset.tags.includes("ai-generated") ? `${asset.mediaType} · AI` : asset.mediaType}</span>
                        <span>{asset.folder}</span>
                        <span>{formatBytes(asset.sizeBytes)}</span>
                        <span>{formatDate(asset.createdAt)}</span>
                      </div>
                    </div>
                  </button></div>)}
                </div>
              )}
            </Card>
          </div>

          <Card className="h-fit p-5 xl:sticky xl:top-6">
            <h2 className="font-serif text-2xl">Asset details</h2>
            {!selectedAsset ? (
              <p className="mt-4 text-sm text-ink/55">Choose an item from the library to review its URL and metadata.</p>
            ) : (
              <div className="mt-4 grid gap-4">
                <MediaThumbnail asset={selectedAsset} fit="contain" className="aspect-[4/3] overflow-hidden rounded-2xl border border-ink/10 bg-mist/60" />

                <div className="grid gap-1 text-sm text-ink/60">
                  <p><span className="font-semibold text-ink">Original file:</span> {selectedAsset.originalName}</p>
                  <p><span className="font-semibold text-ink">Stored file:</span> {selectedAsset.storedFilename}</p>
                  <p><span className="font-semibold text-ink">Type:</span> {selectedAsset.mimeType}</p>
                  <p><span className="font-semibold text-ink">Size:</span> {formatBytes(selectedAsset.sizeBytes)}</p>
                  <p><span className="font-semibold text-ink">Dimensions:</span> {selectedAsset.width && selectedAsset.height ? `${selectedAsset.width} × ${selectedAsset.height}px` : "—"}</p>
                  <p><span className="font-semibold text-ink">Folder:</span> {selectedAsset.folder}</p>
                  <p><span className="font-semibold text-ink">Uploaded:</span> {formatDate(selectedAsset.createdAt)}</p>
                  <p><span className="font-semibold text-ink">Uploader:</span> {selectedAsset.uploader?.name || selectedAsset.uploader?.email || "Unknown"}</p>
                  <p><span className="font-semibold text-ink">Attached pages:</span> {selectedAsset.linkedPages.length ? selectedAsset.linkedPages.map((page) => page.title).join(", ") : "None"}</p>
                </div>

                <a className="focus-ring inline-flex w-fit rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink" href={selectedAsset.url} download={selectedAsset.originalName}>Download original</a>
                {selectedAsset.mediaType === "image" && (
                  <Button type="button" variant="default" className="w-fit px-4 py-2" onClick={() => setEditorOpen(true)}>Edit image</Button>
                )}

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                  Reusable URL
                  <div className="flex gap-2">
                    <input readOnly className="focus-ring min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={reusableUrl} />
                    <Button type="button" variant="default" className="px-4 py-2" onClick={() => void copyUrl()}>Copy</Button>
                  </div>
                </label>

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                  Caption
                  <input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Optional caption" />
                </label>

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                  Description
                  <textarea rows={3} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Additional context about this file" />
                </label>

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                  Title
                  <input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Friendly title" />
                </label>

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                  Alt text
                  <textarea rows={4} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe the image for accessibility" />
                </label>

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                  Tags
                  <input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="sermon, homepage, ministry" />
                </label>

                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                  Folder
                  <div className="flex gap-2">
                    <select className="focus-ring min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={assetFolder} onChange={(event) => setAssetFolder(event.target.value)}>
                      <option value="">Choose folder</option>
                      {folders.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                    </select>
                    <Button type="button" variant="default" className="px-4 py-2" disabled={!assetFolder.trim() || assetFolder.trim() === selectedAsset.folder} onClick={() => void moveSelectedAsset()}>Move</Button>
                  </div>
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" className="px-4 py-2" onClick={() => void saveMetadata()} disabled={!metadataDirty}>Save details</Button>
                  <Button type="button" variant="default" className="px-4 py-2" onClick={() => void loadAssets(selectedAsset.id)}>Refresh</Button>
                  <button type="button" className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral" onClick={() => void removeSelected()}>Delete</button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </Container>
      {editorOpen && selectedAsset && <ImageEditor asset={selectedAsset} onClose={() => setEditorOpen(false)} onSave={(edit) => void saveEditedImage(edit)} />}
    </main>
  );
}

type ImageEditValues = {
  crop?: { left: number; top: number; width: number; height: number };
  width?: number;
  height?: number;
  rotate: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
};

const aspectRatioOptions = [
  { value: "free", label: "Free" },
  { value: "original", label: "Original" },
  { value: "1", label: "1:1" },
  { value: `${4 / 3}`, label: "4:3" },
  { value: `${3 / 2}`, label: "3:2" },
  { value: `${16 / 9}`, label: "16:9" }
] as const;

function ImageEditor({ asset, onClose, onSave }: { asset: MediaAsset; onClose: () => void; onSave: (edit: ImageEditValues) => void }) {
  const cropperRef = useRef<CropperRef>(null);
  const [crop, setCrop] = useState<ImageEditValues["crop"]>();
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [outputScale, setOutputScale] = useState(100);
  const [aspectRatio, setAspectRatio] = useState<(typeof aspectRatioOptions)[number]["value"]>("free");
  const [saving, setSaving] = useState(false);
  const cropWidth = crop?.width ?? asset.width ?? 1;
  const cropHeight = crop?.height ?? asset.height ?? 1;
  const resolvedAspectRatio = aspectRatio === "free" ? undefined : aspectRatio === "original" ? (asset.width && asset.height ? asset.width / asset.height : undefined) : Number(aspectRatio);

  function rotateImage() {
    cropperRef.current?.rotateImage(90);
    setRotate((current) => (current === 270 ? 0 : (current + 90) as 0 | 90 | 180 | 270));
  }

  function flipImage(direction: "horizontal" | "vertical") {
    if (direction === "horizontal") {
      cropperRef.current?.flipImage(true, false);
      setFlipHorizontal((current) => !current);
    } else {
      cropperRef.current?.flipImage(false, true);
      setFlipVertical((current) => !current);
    }
  }

  function resetImage() {
    cropperRef.current?.reset();
    setCrop(undefined);
    setRotate(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
    setOutputScale(100);
    setAspectRatio("free");
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="image-editor-title">
      <div className="mx-auto grid max-w-5xl gap-6 rounded-[var(--site-radius-card)] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-coral">Non-destructive edit</p>
            <h2 id="image-editor-title" className="mt-1 font-serif text-3xl">Edit image</h2>
            <p className="mt-2 text-sm text-ink/60">Save a new edited asset. The original file and any pages using it will not change.</p>
          </div>
          <button type="button" className="focus-ring rounded-full border border-ink/15 px-3 py-2 text-sm font-semibold text-ink" onClick={onClose}>Close</button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-ink/10 bg-mist/60 p-4">
            <div className="h-[min(58vh,620px)] w-full max-w-3xl">
              <Cropper
                ref={cropperRef}
                src={asset.url}
                className="h-full w-full"
                stencilProps={{ handlers: true, movable: true, resizable: true, aspectRatio: resolvedAspectRatio }}
                onChange={(cropper) => {
                  const coordinates = cropper.getCoordinates();
                  if (coordinates) setCrop({ left: Math.round(coordinates.left), top: Math.round(coordinates.top), width: Math.round(coordinates.width), height: Math.round(coordinates.height) });
                }}
              />
            </div>
          </div>
          <div className="grid content-start gap-4">
            <fieldset className="grid gap-3 rounded-xl border border-ink/10 p-4">
              <legend className="px-1 text-sm font-semibold text-ink">Transform</legend>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold text-ink" onClick={rotateImage}>Rotate 90° <span className="text-ink/50">({rotate}°)</span></button>
              </div>
              <button type="button" className={`focus-ring rounded-lg border px-3 py-2 text-left text-sm font-semibold ${flipHorizontal ? "border-coral bg-coral/10 text-coral" : "border-ink/15 text-ink"}`} onClick={() => flipImage("horizontal")}>Flip horizontally</button>
              <button type="button" className={`focus-ring rounded-lg border px-3 py-2 text-left text-sm font-semibold ${flipVertical ? "border-coral bg-coral/10 text-coral" : "border-ink/15 text-ink"}`} onClick={() => flipImage("vertical")}>Flip vertically</button>
            </fieldset>
            <fieldset className="grid gap-3 rounded-xl border border-ink/10 p-4">
              <legend className="px-1 text-sm font-semibold text-ink">Crop and resize</legend>
              <p className="text-xs leading-5 text-ink/55">Drag inside the frame to move it. Drag any edge or corner to crop and resize the selected area.</p>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                Crop ratio
                <select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as (typeof aspectRatioOptions)[number]["value"])}>
                  {aspectRatioOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <p className="text-xs font-semibold text-ink">{crop ? `${crop.width} × ${crop.height}px selection` : "Adjust the frame to choose a crop"}</p>
            </fieldset>
            <fieldset className="grid gap-3 rounded-xl border border-ink/10 p-4">
              <legend className="px-1 text-sm font-semibold text-ink">Output resize</legend>
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-wider text-ink/55">
                Scale
                <input type="range" min={25} max={200} step={5} value={outputScale} onChange={(event) => setOutputScale(Number(event.target.value))} />
              </label>
              <div className="flex items-center justify-between text-xs text-ink/55">
                <span>25%</span>
                <span className="font-semibold text-ink">{outputScale}% · {Math.max(1, Math.round(cropWidth * outputScale / 100))} × {Math.max(1, Math.round(cropHeight * outputScale / 100))}px</span>
                <span>200%</span>
              </div>
            </fieldset>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink" onClick={resetImage}>Reset edits</button>
              <button type="button" className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink" onClick={onClose}>Cancel</button>
              <Button type="button" className="px-4 py-2" disabled={saving} onClick={() => { setSaving(true); onSave({ crop, width: Math.max(1, Math.round(cropWidth * outputScale / 100)), height: Math.max(1, Math.round(cropHeight * outputScale / 100)), rotate, flipHorizontal, flipVertical }); }}>{saving ? "Creating..." : "Create edited image"}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaThumbnail({ asset, className = "", fit = "cover" }: { asset: MediaAsset; className?: string; fit?: "cover" | "contain" }) {
  if (asset.mediaType === "image") {
    return (
      <div className={`relative ${className}`}>
        <Image src={asset.url} alt={asset.altText ?? asset.title ?? asset.originalName} fill sizes="(min-width: 1280px) 20rem, (min-width: 640px) 50vw, 100vw" className={`object-${fit}`} unoptimized />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="grid gap-1 text-center">
        <span className="text-2xl">📁</span>
        <span className="px-3 text-xs font-semibold uppercase tracking-wide text-ink/55">{asset.mediaType}</span>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
