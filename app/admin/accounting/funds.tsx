"use client";

import { useEffect, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Fund = { id: string; code: string; name: string; description: string | null; isActive: boolean; sortOrder: number };

function SortableFund({ fund, onEdit, onDelete, onToggle }: { fund: Fund; onEdit: (fund: Fund) => void; onDelete: (fund: Fund) => void; onToggle: (fund: Fund) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: fund.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink/10 bg-white p-4 shadow-sm ${isDragging ? "ring-2 ring-coral/30 shadow-lg" : ""}`}>
    <div className="flex min-w-0 items-center gap-3"><button type="button" {...attributes} {...listeners} className="focus-ring touch-none cursor-grab rounded-lg px-2 py-1 text-lg text-ink/40 active:cursor-grabbing" aria-label={`Drag ${fund.name} to reorder`}>☰</button><div className={!fund.isActive ? "opacity-50" : ""}><p className="font-semibold">{fund.code} — {fund.name}</p>{fund.description && <p className="mt-1 text-sm text-ink/55">{fund.description}</p>}<p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink/40">{fund.isActive ? "Active" : "Inactive"}</p></div></div>
    <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => onToggle(fund)} className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm font-semibold">{fund.isActive ? "Disable" : "Enable"}</button><button type="button" onClick={() => onEdit(fund)} className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral">Edit</button><button type="button" onClick={() => onDelete(fund)} className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm font-semibold text-ink/70">Delete</button></div>
  </div>;
}

export function Funds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [editing, setEditing] = useState<Fund | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function load() {
    setLoading(true);
    try { const response = await fetch("/api/accounting/funds"); const value = await response.json(); if (!response.ok) throw new Error(value.error ?? "Unable to load funds."); setFunds(value.funds ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load funds."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  function beginAdd() { setEditing(null); setForm({ code: "", name: "", description: "" }); setError(""); setFormOpen(true); }
  function beginEdit(fund: Fund) { setEditing(fund); setForm({ code: fund.code, name: fund.name, description: fund.description ?? "" }); setError(""); setFormOpen(true); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try { const response = await fetch(editing ? `/api/accounting/funds/${editing.id}` : "/api/accounting/funds", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const value = await response.json(); if (!response.ok) throw new Error(value.error ?? "Unable to save fund."); await load(); setEditing(null); setFormOpen(false); setForm({ code: "", name: "", description: "" }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save fund."); }
    finally { setSaving(false); }
  }
  async function toggle(fund: Fund) { await update(fund, { isActive: !fund.isActive }); }
  async function update(fund: Fund, changes: Record<string, unknown>) { setError(""); const response = await fetch(`/api/accounting/funds/${fund.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) }); const value = await response.json(); if (!response.ok) { setError(value.error ?? "Unable to update fund."); return; } await load(); }
  async function remove(fund: Fund) { if (!window.confirm(`Delete ${fund.name}?`)) return; setError(""); const response = await fetch(`/api/accounting/funds/${fund.id}`, { method: "DELETE" }); const value = await response.json(); if (!response.ok) { setError(value.error ?? "Unable to delete fund."); return; } await load(); }
  async function reorder(event: DragEndEvent) { const oldIndex = funds.findIndex((fund) => fund.id === event.active.id); const newIndex = funds.findIndex((fund) => fund.id === event.over?.id); if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return; const next = arrayMove(funds, oldIndex, newIndex).map((fund, index) => ({ ...fund, sortOrder: index })); setFunds(next); const results = await Promise.all(next.map((fund) => fetch(`/api/accounting/funds/${fund.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: fund.sortOrder }) }))); if (results.some((response) => !response.ok)) { setError("Unable to save fund order."); await load(); } }
    return <div className="mt-8 font-sans"><div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><div><h2 className="text-2xl font-semibold tracking-tight">Funds</h2><p className="mt-1 max-w-xl text-sm text-ink/60">Manage the funds used to classify accounting activity.</p></div><button type="button" onClick={beginAdd} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral/90">Add fund</button></div>
    {formOpen && <form onSubmit={save} className="mt-5 grid gap-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:grid-cols-2"><h3 className="sm:col-span-2 text-lg font-semibold">{editing ? "Edit fund" : "Add fund"}</h3><label className="grid gap-1 text-sm font-semibold">Code<input required maxLength={40} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-sans" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Name<input required maxLength={120} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-sans" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold sm:col-span-2">Description<textarea maxLength={500} rows={2} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-sans" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={saving} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">{saving ? "Saving…" : editing ? "Save changes" : "Add fund"}</button><button type="button" onClick={() => { setEditing(null); setFormOpen(false); }} className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">Cancel</button></div></form>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</p>}{loading ? <p className="mt-6 text-sm text-ink/55">Loading funds…</p> : <div className="mt-6 grid gap-3"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void reorder(event)}><SortableContext items={funds.map((fund) => fund.id)} strategy={verticalListSortingStrategy}>{funds.map((fund) => <SortableFund key={fund.id} fund={fund} onEdit={beginEdit} onDelete={(item) => void remove(item)} onToggle={(item) => void toggle(item)} />)}</SortableContext></DndContext>{!funds.length && <p className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/55">No funds have been added yet.</p>}</div>}</div>;
}
