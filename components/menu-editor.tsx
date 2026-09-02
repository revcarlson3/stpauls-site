"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

type MenuItem = { id?: string; tempId?: string; label: string; href: string; position: number; parentId?: string | null; itemType: "INTERNAL" | "EXTERNAL"; openInNewTab: boolean };
type Menu = { name: string; slug: string; items: MenuItem[] };
type PageOption = { id: string; title: string; slug: string };
const emptyItem = (): MenuItem => ({ label: "", href: "", position: 0, parentId: null, itemType: "INTERNAL", openInNewTab: false });

export function MenuEditor({ id }: { id: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [draft, setDraft] = useState<MenuItem>(emptyItem());
  const [editingId, setEditingId] = useState<string>();
  const [message, setMessage] = useState("Loading menu...");

  useEffect(() => {
    void Promise.all([fetch(`/api/menus/${id}`), fetch("/api/menus/options")])
      .then(async ([menuResponse, pagesResponse]) => {
        if (!menuResponse.ok || !pagesResponse.ok) throw new Error("Unable to load menu.");
        const loaded = await menuResponse.json() as Menu;
        setMenu(loaded); setName(loaded.name); setSlug(loaded.slug); setPages(await pagesResponse.json() as PageOption[]); setMessage("");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load menu."));
  }, [id]);

  function editItem(item: MenuItem) { setDraft({ ...item }); setEditingId(item.id ?? item.tempId); }
  function addOrUpdateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.label.trim() || !draft.href.trim() || !menu) return;
    const items = editingId ? menu.items.map((item) => (item.id ?? item.tempId) === editingId ? { ...draft } : item) : [...menu.items, { ...draft, parentId: draft.parentId && menu.items.some((item) => item.id === draft.parentId) ? draft.parentId : null, tempId: `new-${Date.now()}`, position: menu.items.length }];
    setMenu({ ...menu, items }); setDraft(emptyItem()); setEditingId(undefined);
  }
  function removeItem(itemKey: string) { if (menu) setMenu({ ...menu, items: menu.items.filter((item) => (item.id ?? item.tempId) !== itemKey).map((item, position) => ({ ...item, position })) }); }
  function moveItem(index: number, direction: -1 | 1) {
    if (!menu) return;
    const target = index + direction;
    if (target < 0 || target >= menu.items.length) return;
    const items = [...menu.items]; [items[index], items[target]] = [items[target], items[index]];
    setMenu({ ...menu, items: items.map((item, position) => ({ ...item, position })) });
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
  return <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-serif text-2xl">Menu items</h2><p className="mt-1 text-sm text-ink/55">Add internal pages or external URLs, then reorder them.</p></div></div>
      <div className="mt-5 grid gap-2">
        {menu.items.length === 0 && <p className="rounded-lg bg-mist p-4 text-sm text-ink/60">This menu has no items yet.</p>}
        {menu.items.map((item, index) => <div key={item.id ?? item.tempId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/10 px-4 py-3 text-sm" style={{ marginLeft: item.parentId ? "1.25rem" : undefined }}><div><p className="font-semibold">{item.label}</p><p className="text-ink/50">{item.href} · {item.itemType === "EXTERNAL" ? "external" : "internal"}{item.parentId ? " · submenu item" : ""}{item.openInNewTab ? " · new tab" : ""}</p></div><div className="flex gap-2"><button type="button" className="focus-ring rounded px-2 py-1 hover:bg-mist" onClick={() => moveItem(index, -1)} disabled={index === 0}>↑</button><button type="button" className="focus-ring rounded px-2 py-1 hover:bg-mist" onClick={() => moveItem(index, 1)} disabled={index === menu.items.length - 1}>↓</button><button type="button" className="focus-ring rounded px-2 py-1 text-coral hover:bg-sand" onClick={() => editItem(item)}>Edit</button><button type="button" className="focus-ring rounded px-2 py-1 text-coral hover:bg-sand" onClick={() => removeItem(item.id ?? item.tempId ?? "")}>Delete</button></div></div>)}
      </div>
      <form className="mt-6 grid gap-3 border-t border-ink/10 pt-5" onSubmit={addOrUpdateItem}>
        <h3 className="font-semibold">{editingId ? "Edit item" : "Add item"}</h3>
        <input required placeholder="Link label" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink" />
        <select value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value as MenuItem["itemType"], href: event.target.value === "INTERNAL" ? "/" : "" })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink"><option value="INTERNAL">Internal page</option><option value="EXTERNAL">External URL</option></select>
        {draft.itemType === "INTERNAL" ? <select required value={draft.href} onChange={(event) => setDraft({ ...draft, href: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink"><option value="">Select a published page</option>{pages.map((page) => <option key={page.id} value={`/${page.slug}`}>{page.title}</option>)}</select> : <input required type="url" placeholder="https://example.com" value={draft.href} onChange={(event) => setDraft({ ...draft, href: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink" />}
        <select value={draft.parentId ?? ""} onChange={(event) => setDraft({ ...draft, parentId: event.target.value || null })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink"><option value="">Top-level item</option>{menu.items.filter((item) => item.id && item.id !== editingId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.openInNewTab} onChange={(event) => setDraft({ ...draft, openInNewTab: event.target.checked })} /> Open in a new tab</label>
        <Button type="submit">{editingId ? "Update item" : "Add item"}</Button>
      </form>
    </Card>
    <Card className="h-fit"><h2 className="font-serif text-2xl">Menu settings</h2><form className="mt-5 grid gap-4" onSubmit={(event) => void saveMenu(event)}><label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" /></label><label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" /></label><Button type="submit">Save menu</Button>{message && <p role="status" className="text-sm text-ink/60">{message}</p>}<Link href="/admin/navigation" className="text-center text-sm font-semibold text-coral hover:underline">Back to menus</Link></form></Card>
  </div>;
}
