"use client";

import { useEffect, useState } from "react";
import { Card, Container } from "@/components/ui";

type Widget = { id: string; name: string; type: "menu" | "text"; area: "sidebar" | "footer" | "page"; config: { menuId?: string; content?: string; pageId?: string }; position: number; enabled: boolean };
type Menu = { id: string; name: string };
type Page = { id: string; title: string; slug: string };

const blank = { name: "", type: "menu" as "menu" | "text", area: "sidebar" as "sidebar" | "footer" | "page", menuId: "", content: "", pageId: "", position: 0, enabled: true };

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const [widgetResponse, menuResponse, pageResponse] = await Promise.all([fetch("/api/widgets"), fetch("/api/menus/options"), fetch("/api/pages")]);
    if (widgetResponse.ok) setWidgets(await widgetResponse.json());
    if (menuResponse.ok) setMenus(await menuResponse.json());
    if (pageResponse.ok) setPages((await pageResponse.json()).map((page: Page) => ({ id: page.id, title: page.title, slug: page.slug })));
  }
  useEffect(() => { void load(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = { name: form.name, type: form.type, area: form.area, position: Number(form.position), enabled: form.enabled, config: form.type === "menu" ? { menuId: form.menuId, ...(form.area === "page" && form.pageId ? { pageId: form.pageId } : {}) } : { content: form.content, ...(form.area === "page" && form.pageId ? { pageId: form.pageId } : {}) } };
    const response = await fetch(editing ? `/api/widgets/${editing}` : "/api/widgets", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error ?? "Unable to save widget."); return; }
    setMessage("Widget saved."); setEditing(null); setForm(blank); await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this widget?")) return;
    const response = await fetch(`/api/widgets/${id}`, { method: "DELETE" });
    if (response.ok) await load();
  }

  function edit(widget: Widget) {
    setEditing(widget.id);
    setForm({ name: widget.name, type: widget.type, area: widget.area, menuId: widget.config.menuId ?? "", content: widget.config.content ?? "", pageId: widget.config.pageId ?? "", position: widget.position, enabled: widget.enabled });
  }

  return <main><Container className="py-10 sm:py-14"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Content</p><h1 className="mt-2 font-serif text-4xl">Widgets</h1><p className="mt-2 text-ink/60">Create reusable menus and content for shared site areas.</p></div><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]"><div className="grid gap-4">{widgets.length === 0 ? <Card><p className="text-ink/60">No widgets have been created yet.</p></Card> : widgets.map((widget) => <Card key={widget.id} className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl">{widget.name}</h2><p className="mt-1 text-sm text-ink/55">{widget.type} · {widget.area} · {widget.enabled ? "enabled" : "disabled"}</p></div><div className="flex gap-3"><button type="button" className="focus-ring text-sm font-semibold text-coral" onClick={() => edit(widget)}>Edit</button><button type="button" className="focus-ring text-sm font-semibold text-ink/60" onClick={() => void remove(widget.id)}>Delete</button></div></Card>)}</div><Card><h2 className="font-semibold">{editing ? "Edit widget" : "Add widget"}</h2><form className="mt-4 grid gap-3" onSubmit={save}><label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Name<input required className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Type<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as "menu" | "text" })}><option value="menu">Menu</option><option value="text">Text</option></select></label><label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Area<select className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value as Widget["area"] })}><option value="sidebar">Sidebar</option><option value="footer">Footer</option><option value="page">Page-specific</option></select></label>{form.area === "page" && <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Page<select required className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={form.pageId} onChange={(event) => setForm({ ...form, pageId: event.target.value })}><option value="">Select a page</option>{pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}</select></label>}{form.type === "menu" ? <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Menu<select required className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={form.menuId} onChange={(event) => setForm({ ...form, menuId: event.target.value })}><option value="">Select a menu</option>{menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select></label> : <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Content<textarea rows={5} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>}<label className="flex items-center justify-between gap-3 text-sm text-ink/70">Enabled<input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /></label><button className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white" type="submit">{editing ? "Save changes" : "Add widget"}</button>{editing && <button type="button" className="focus-ring text-sm text-ink/60" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}{message && <p className="text-sm text-ink/60">{message}</p>}</form></Card></div></Container></main>;
}
