"use client";

import { useEffect, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Container, Notification } from "@/components/ui";

type MemberType = { id: string; name: string; slug: string; position: number; _count: { individuals: number } };
type DocumentCleanupPreview = {
  asOf: string;
  expiredCount: number;
  expiredSizeBytes: number;
  truncated: boolean;
  documents: Array<{ id: string; originalName: string; expiresAt: string; family: { lastName: string } }>;
};

function fileSizeLabel(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SortableMemberType({ type, onRemove }: { type: MemberType; onRemove: (type: MemberType) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: type.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 p-4 ${isDragging ? "bg-white shadow-xl ring-2 ring-coral/20" : ""}`}>
    <div className="flex min-w-0 items-center gap-3">
      <button type="button" {...attributes} {...listeners} className="focus-ring touch-none cursor-grab rounded-lg px-2 py-1 text-lg text-ink/40 active:cursor-grabbing" aria-label={`Drag ${type.name} to reorder`}>☰</button>
      <div><p className="font-semibold">{type.name}</p><p className="text-xs text-ink/55">{type._count.individuals} assigned member{type._count.individuals === 1 ? "" : "s"} · {type.slug}</p></div>
    </div>
    <button type="button" onClick={() => onRemove(type)} className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral hover:bg-coral hover:text-white">Remove</button>
  </div>;
}

export default function MembershipSettingsPage() {
  const [types, setTypes] = useState<MemberType[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [ageCategories, setAgeCategories] = useState<string[]>([]);
  const [ageCategoryName, setAgeCategoryName] = useState("");
  const [advancingGrades, setAdvancingGrades] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<DocumentCleanupPreview | null>(null);
  const [previewingCleanup, setPreviewingCleanup] = useState(false);
  const [cleaningDocuments, setCleaningDocuments] = useState(false);
  const [cronCopied, setCronCopied] = useState(false);
  const cronCommand = "0 2 1 9 * cd /path/to/stpauls-site && npm run membership:advance-grades >> /path/to/stpauls-site/logs/membership-cron.log 2>&1";
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function loadTypes() {
    setLoading(true);
    try {
      const response = await fetch("/api/membership/member-types");
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load member types.");
      setTypes(value.types ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load member types.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTypes(); }, []);
  useEffect(() => { void fetch("/api/membership/age-categories").then((response) => response.json()).then((value) => setAgeCategories(value.categories ?? [])); }, []);

  async function addType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const response = await fetch("/api/membership/member-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(value.error ?? "Unable to add member type.");
      return;
    }
    setName("");
    setMessage("Member type added.");
    await loadTypes();
  }

  async function removeType(type: MemberType) {
    if (!window.confirm(`Remove the "${type.name}" member type?`)) return;
    setMessage("");
    setError("");
    const response = await fetch(`/api/membership/member-types?id=${encodeURIComponent(type.id)}`, { method: "DELETE" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(value.error ?? "Unable to remove member type.");
      return;
    }

    setMessage("Member type removed.");
    await loadTypes();
  }

  async function reorder(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = types.findIndex((type) => type.id === event.active.id);
    const newIndex = types.findIndex((type) => type.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(types, oldIndex, newIndex).map((type, position) => ({ ...type, position }));
    setTypes(next);
    setSavingOrder(true);
    setError("");
    const response = await fetch("/api/membership/member-types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: next.map((type) => type.id) }) });
    const value = await response.json().catch(() => ({}));
    setSavingOrder(false);
    if (!response.ok) {
      setError(value.error ?? "Unable to save member type order.");
      await loadTypes();
      return;
    }

    setMessage("Member type order saved.");
  }

  async function addAgeCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/membership/age-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: ageCategoryName }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to add age category."); return; }
    setAgeCategoryName("");
    setAgeCategories(value.categories ?? []);
    setMessage("Age category added.");
  }

  async function removeAgeCategory(category: string) {
    if (!window.confirm(`Remove the "${category}" age category?`)) return;
    const response = await fetch(`/api/membership/age-categories?name=${encodeURIComponent(category)}`, { method: "DELETE" });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to remove age category."); return; }
    setAgeCategories(value.categories ?? []);
    setMessage("Age category removed.");
  }

  async function advanceGrades() {
    if (!window.confirm("Advance all school-age members by one grade? Members without a grade will receive an estimate from their birthday.")) return;
    setAdvancingGrades(true);
    setError("");
    const response = await fetch("/api/membership/grade-levels/advance", { method: "POST" });
    const value = await response.json();
    setAdvancingGrades(false);
    if (!response.ok) { setError(value.error ?? "Unable to advance grade levels."); return; }
    setMessage(`${value.updated ?? 0} grade level${value.updated === 1 ? "" : "s"} updated.`);
  }

  async function copyCronCommand() {
    if (!navigator.clipboard) {
      setError("Copy is unavailable in this browser. Select the command and copy it manually.");
      return;
    }
    await navigator.clipboard.writeText(cronCommand);
    setCronCopied(true);
    window.setTimeout(() => setCronCopied(false), 2500);
  }

  async function previewDocumentCleanup() {
    setPreviewingCleanup(true);
    setCleanupPreview(null);
    setError("");
    try {
      const response = await fetch("/api/membership/documents/cleanup");
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to preview expired documents.");
      setCleanupPreview(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to preview expired documents.");
    } finally {
      setPreviewingCleanup(false);
    }
  }

  async function cleanExpiredDocuments() {
    if (!cleanupPreview?.expiredCount) return;
    if (!window.confirm(`Permanently delete ${cleanupPreview.expiredCount} expired membership document${cleanupPreview.expiredCount === 1 ? "" : "s"}? Documents without an expiry or with a future expiry will not be deleted.`)) return;
    setCleaningDocuments(true);
    setError("");
    try {
      const response = await fetch("/api/membership/documents/cleanup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE_EXPIRED_MEMBERSHIP_DOCUMENTS", asOf: cleanupPreview.asOf })
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to clean up expired documents.");
      setMessage(`${value.deletedCount} expired document${value.deletedCount === 1 ? "" : "s"} deleted and audited.${value.storageCleanupFailures ? ` ${value.storageCleanupFailures} stored file${value.storageCleanupFailures === 1 ? "" : "s"} could not be removed and require administrator attention.` : ""}`);
      await previewDocumentCleanup();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to clean up expired documents.");
    } finally {
      setCleaningDocuments(false);
    }
  }

  return <main><Container className="py-10 sm:py-14">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="mt-2 font-serif text-4xl">Membership settings</h1><p className="mt-3 max-w-2xl text-ink/60">Manage the member types available when adding and editing individual records.</p></div>
      <a href="/admin/membership" className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Back to directory</a>
    </div>
    <section className="mt-8 max-w-3xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Member types</h2>
      <p className="mt-2 text-sm text-ink/60">Drag the handle to set the order used by member forms and filters. Types assigned to members cannot be removed until those members are assigned a different type.</p>
      <form onSubmit={(event) => void addType(event)} className="mt-5 flex flex-wrap gap-3">
        <label className="grid min-w-64 flex-1 gap-1 text-sm font-semibold">New member type<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Volunteer" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <Button type="submit" className="self-end">Add type</Button>
      </form>
      {message && <Notification variant="success" className="mt-4">{message}</Notification>}
      {error && <Notification variant="danger" className="mt-4">{error}</Notification>}
      <div className="mt-6 grid gap-2" aria-live="polite">
        {loading && <p className="text-sm text-ink/60">Loading member types…</p>}
        {!loading && <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void reorder(event)}><SortableContext items={types.map((type) => type.id)} strategy={verticalListSortingStrategy}><div className="grid gap-2">{types.map((type) => <SortableMemberType key={type.id} type={type} onRemove={(value) => void removeType(value)} />)}</div></SortableContext></DndContext>}
        {!loading && !types.length && <p className="text-sm text-ink/60">No member types have been defined.</p>}
        {savingOrder && <p className="text-xs text-ink/55">Saving order…</p>}
      </div>
    </section>
    <section className="mt-8 max-w-3xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Age categories</h2>
      <p className="mt-2 text-sm text-ink/60">Manage the options available for an individual&apos;s age-category override. Categories assigned to members cannot be removed.</p>
      <form onSubmit={(event) => void addAgeCategory(event)} className="mt-5 flex flex-wrap gap-3">
        <label className="grid min-w-64 flex-1 gap-1 text-sm font-semibold">New age category<input required maxLength={80} value={ageCategoryName} onChange={(event) => setAgeCategoryName(event.target.value)} placeholder="e.g. Young adult" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <Button type="submit" className="self-end">Add category</Button>
      </form>
      <div className="mt-5 grid gap-2">{ageCategories.map((category) => <div key={category} className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3"><span className="font-semibold">{category}</span><button type="button" onClick={() => void removeAgeCategory(category)} className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral">Remove</button></div>)}</div>
    </section>
    <section className="mt-8 max-w-3xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Grade levels</h2>
      <p className="mt-2 text-sm text-ink/60">New individuals receive an estimated grade from their birthday when no grade is selected. Run this once each school year to advance members from preschool through 12th grade.</p>
      <Button type="button" onClick={() => void advanceGrades()} disabled={advancingGrades} className="mt-5">{advancingGrades ? "Updating grades…" : "Advance grade levels"}</Button>
    </section>
    <section className="mt-8 max-w-3xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Document retention cleanup</h2>
      <p className="mt-2 text-sm text-ink/60">Cleanup is manual and disabled by default. Only documents whose saved expiry has passed are eligible. Documents with no expiry or a future expiry are always excluded.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="button" onClick={() => void previewDocumentCleanup()} disabled={previewingCleanup || cleaningDocuments}>{previewingCleanup ? "Checking…" : "Preview expired documents"}</Button>
        {cleanupPreview && cleanupPreview.expiredCount > 0 && <Button type="button" onClick={() => void cleanExpiredDocuments()} disabled={cleaningDocuments}>{cleaningDocuments ? "Deleting…" : "Delete previewed expired documents"}</Button>}
      </div>
      {cleanupPreview && <div className="mt-4 rounded-xl border border-ink/10 bg-mist/40 p-4" aria-live="polite">
        <p className="text-sm font-semibold">{cleanupPreview.expiredCount} expired document{cleanupPreview.expiredCount === 1 ? "" : "s"} · {fileSizeLabel(cleanupPreview.expiredSizeBytes)}</p>
        {!cleanupPreview.expiredCount && <p className="mt-1 text-xs text-ink/55">Nothing is eligible for cleanup.</p>}
        {!!cleanupPreview.documents.length && <ul className="mt-3 grid gap-1 text-xs text-ink/70">
          {cleanupPreview.documents.map((document) => <li key={document.id}>{document.originalName} · {document.family.lastName} family · expired {new Date(document.expiresAt).toLocaleDateString()}</li>)}
        </ul>}
        {cleanupPreview.truncated && <p className="mt-2 text-xs text-ink/55">Showing the first 100 expired documents. Cleanup applies to the full preview count.</p>}
      </div>}
    </section>
    <section className="mt-8 max-w-3xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Scheduled tasks</h2>
      <p className="mt-2 text-sm text-ink/60">For shared hosting or servers with cron, add this line to run grade advancement once each September. Replace both <code>/path/to/stpauls-site</code> values with the absolute installation path and make sure the log directory exists.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <textarea readOnly value={cronCommand} aria-label="Grade advancement cron command" className="focus-ring min-h-24 flex-1 rounded-lg border border-ink/15 bg-ink/[0.03] p-3 font-mono text-xs leading-5 text-ink/75" />
        <Button type="button" onClick={() => void copyCronCommand()} className="shrink-0">{cronCopied ? "Copied" : "Copy command"}</Button>
      </div>
      <p className="mt-3 text-xs text-ink/55">The command is idempotent for each school year, so rerunning it does not advance grades twice.</p>
    </section>
  </Container></main>;
}
