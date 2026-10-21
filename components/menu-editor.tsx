"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card } from "@/components/ui";
import { orderMenuItems } from "@/lib/menu-input";

type MenuItem = { id?: string; tempId?: string; label: string; href: string; position: number; parentId?: string | null; itemType: "INTERNAL" | "EXTERNAL"; openInNewTab: boolean };
type Menu = { name: string; slug: string; items: MenuItem[] };
type PageOption = { id: string; title: string; slug: string };
const emptyItem = (): MenuItem => ({ label: "", href: "", position: 0, parentId: null, itemType: "INTERNAL", openInNewTab: false });
const itemKey = (item: MenuItem) => item.id ?? item.tempId ?? "";

function SortableMenuItem({ item, depth, onEdit, onDelete }: { item: MenuItem; depth: number; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: itemKey(item) });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, marginLeft: depth ? `${depth * 1.25}rem` : undefined }} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm ${isDragging ? "z-10 opacity-70 shadow-lg" : ""}`}>
    <div className="flex min-w-0 items-center gap-3"><button type="button" {...attributes} {...listeners} className="focus-ring touch-none cursor-grab rounded-md px-2 py-1 text-ink/40 active:cursor-grabbing" aria-label={`Drag ${item.label} to reorder`}>☰</button><div className="min-w-0"><p className="font-semibold">{item.label}</p><p className="truncate text-ink/50">{item.href} · {item.itemType === "EXTERNAL" ? "external" : "internal"}{item.parentId ? " · submenu item" : ""}{item.openInNewTab ? " · new tab" : ""}</p></div></div>
    <div className="flex gap-2"><button type="button" className="focus-ring rounded px-2 py-1 text-coral hover:bg-sand" onClick={onEdit}>Edit</button><button type="button" className="focus-ring rounded px-2 py-1 text-coral hover:bg-sand" onClick={onDelete}>Delete</button></div>
  </div>;
}

export function MenuEditor({ id }: { id: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [draft, setDraft] = useState<MenuItem>(emptyItem());
  const [editingId, setEditingId] = useState<string>();
  const [message, setMessage] = useState("Loading menu...");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    void Promise.all([fetch(`/api/menus/${id}`), fetch("/api/pages/options")])
      .then(async ([menuResponse, pagesResponse]) => {
        if (!menuResponse.ok || !pagesResponse.ok) throw new Error("Unable to load menu.");
        const loaded = await menuResponse.json() as Menu;
        setMenu(loaded); setName(loaded.name); setSlug(loaded.slug); setPages(await pagesResponse.json() as PageOption[]); setMessage("");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load menu."));
  }, [id]);

  function editItem(item: MenuItem) { setDraft({ ...item }); setEditingId(itemKey(item)); }
  async function persistItems(items: MenuItem[]) {
    if (!menu) return;
    setMessage("Saving menu items...");
    const response = await fetch(`/api/menus/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, items: items.map(({ tempId: _tempId, ...item }) => item) }) });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(result?.error ?? "Unable to save menu items.");
      return;
    }
    setMenu(await response.json() as Menu);
    setMessage("Menu items saved.");
  }
  function addOrUpdateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.label.trim() || (draft.itemType === "EXTERNAL" && !draft.href.trim()) || !menu) return;
    const items = editingId ? menu.items.map((item) => itemKey(item) === editingId ? { ...draft } : item) : [...menu.items, { ...draft, parentId: draft.parentId && menu.items.some((item) => item.id === draft.parentId) ? draft.parentId : null, tempId: `new-${Date.now()}`, position: menu.items.length }];
    setMenu({ ...menu, items }); setDraft(emptyItem()); setEditingId(undefined); void persistItems(items);
  }
  function removeItem(itemKeyToRemove: string) {
    if (!menu) return;
    const items = menu.items.filter((item) => itemKey(item) !== itemKeyToRemove).map((item, position) => ({ ...item, position }));
    setMenu({ ...menu, items }); void persistItems(items);
  }
  function reorderItems(event: DragEndEvent) {
    if (!menu || !event.over || event.active.id === event.over.id) return;
    const ordered = orderMenuItems(menu.items);
    const activeIndex = ordered.findIndex(({ item }) => itemKey(item) === event.active.id);
    const overIndex = ordered.findIndex(({ item }) => itemKey(item) === event.over?.id);
    if (activeIndex < 0 || overIndex < 0) return;
    const activeDepth = ordered[activeIndex].depth;
    const movingKeys = new Set<string>([event.active.id as string]);
    for (let index = activeIndex + 1; index < ordered.length && ordered[index].depth > activeDepth; index += 1) movingKeys.add(itemKey(ordered[index].item));
    if (movingKeys.has(event.over.id as string)) return;
    const remaining = ordered.filter(({ item }) => !movingKeys.has(itemKey(item)));
    const targetIndex = remaining.findIndex(({ item }) => itemKey(item) === event.over?.id);
    if (targetIndex < 0) return;
    const moving = ordered.filter(({ item }) => movingKeys.has(itemKey(item)));
    const before = remaining[targetIndex - 1];
    const requestedDepth = Math.max(0, activeDepth + Math.round(event.delta.x / 32));
    const nextDepth = Math.min(requestedDepth, before ? before.depth + 1 : 0);
    const parent = nextDepth === 0 ? null : [...remaining.slice(0, targetIndex)].reverse().find(({ depth }) => depth === nextDepth - 1);
    const nextOrdered = [...remaining.slice(0, targetIndex), ...moving, ...remaining.slice(targetIndex)];
    const activeItemKey = event.active.id as string;
    const nextItems = nextOrdered.map(({ item }, position) => ({ ...item, parentId: itemKey(item) === activeItemKey ? (parent ? itemKey(parent.item) : null) : item.parentId, position }));
    setMenu({ ...menu, items: nextItems });
    void persistItems(nextItems);
  }
  async function saveMenu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const items = (menu?.items ?? []).map(({ tempId: _tempId, ...item }) => item);
    const response = await fetch(`/api/menus/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug, items }) });
    if (!response.ok) { const result = await response.json().catch(() => null) as { error?: string } | null; setMessage(result?.error ?? "Unable to save menu."); return; }
    setMenu(await response.json() as Menu); setMessage("Menu saved.");
  }

  if (!menu && message === "Loading menu...") return <p role="status" className="text-sm text-ink/60">{message}</p>;
  if (!menu) return <Card><p role="alert" className="text-sm text-coral">{message}</p></Card>;
  const orderedItems = orderMenuItems(menu.items);
  return <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-serif text-2xl">Menu items</h2><p className="mt-1 text-sm text-ink/55">Drag the handle to reorder. Drag right to make an item a child, or left to move it back to the top level. Parent items carry their children with them.</p></div></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderItems}>
        <SortableContext items={orderedItems.map(({ item }) => itemKey(item))} strategy={verticalListSortingStrategy}>
          <div className="mt-5 grid gap-2">{menu.items.length === 0 && <p className="rounded-lg bg-mist p-4 text-sm text-ink/60">This menu has no items yet.</p>}{orderedItems.map(({ item, depth }) => <SortableMenuItem key={itemKey(item)} item={item} depth={depth} onEdit={() => editItem(item)} onDelete={() => removeItem(itemKey(item))} />)}</div>
        </SortableContext>
      </DndContext>
      <form className="mt-6 grid gap-3 border-t border-ink/10 pt-5" onSubmit={addOrUpdateItem}>
        <h3 className="font-semibold">{editingId ? "Edit item" : "Add item"}</h3>
        <input required placeholder="Link label" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink" />
        <select value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value as MenuItem["itemType"], href: event.target.value === "INTERNAL" ? "/" : "" })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink"><option value="INTERNAL">Internal page</option><option value="EXTERNAL">External URL</option></select>
        {draft.itemType === "INTERNAL" ? <select value={draft.href} onChange={(event) => setDraft({ ...draft, href: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink"><option value="">No page (parent only)</option>{pages.map((page) => <option key={page.id} value={`/${page.slug}`}>{page.title}</option>)}</select> : <input required type="url" placeholder="https://example.com" value={draft.href} onChange={(event) => setDraft({ ...draft, href: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink" />}
        <select value={draft.parentId ?? ""} onChange={(event) => setDraft({ ...draft, parentId: event.target.value || null })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink"><option value="">Top-level item</option>{menu.items.filter((item) => item.id && item.id !== editingId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.openInNewTab} onChange={(event) => setDraft({ ...draft, openInNewTab: event.target.checked })} /> Open in a new tab</label>
        <Button type="submit">{editingId ? "Update item" : "Add item"}</Button>
      </form>
    </Card>
    <Card className="h-fit"><h2 className="font-serif text-2xl">Menu settings</h2><form className="mt-5 grid gap-4" onSubmit={(event) => void saveMenu(event)}><label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" /></label><label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" /></label><Button type="submit">Save menu</Button>{message && <p role="status" className="text-sm text-ink/60">{message}</p>}<Link href="/admin/navigation" className="text-center text-sm font-semibold text-coral hover:underline">Back to menus</Link></form></Card>
  </div>;
}
