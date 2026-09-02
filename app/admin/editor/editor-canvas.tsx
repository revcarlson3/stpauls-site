"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { blockDefinitions, type BlockType } from "@/lib/blocks";

type Block = { id: string; type: BlockType; title: string; content: string; mediaType?: "image" | "video"; mediaUrl?: string; span: number; menuId?: string | null; menuLocationId?: string | null };
type MenuOption = { id: string; name: string };
type LocationOption = { id: string; name: string };
const menuBlocks: BlockType[] = ["pre-header", "header", "hero", "sidebar", "footer"];

const initialBlocks: Block[] = [
  { id: "hero-1", type: "hero", title: "A place to belong.", content: "There is room for you here.", mediaType: "image", mediaUrl: "", span: 12 },
  { id: "headline-1", type: "headline", title: "Make space for what matters.", content: "A community learning to live with courage and compassion.", span: 7 },
  { id: "news-1", type: "news", title: "Latest from St. Paul's", content: "Choose a category for the latest updates.", span: 5 }
];

export default function EditorCanvas({ pageId, empty = false }: { pageId?: string; empty?: boolean }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(empty ? [] : initialBlocks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState(empty ? "" : "Welcome page");
  const [slug, setSlug] = useState(empty ? "" : "welcome");
  const [message, setMessage] = useState("");
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  useEffect(() => {
    void Promise.all([fetch("/api/menus"), fetch("/api/menu-locations")]).then(async ([menusResponse, locationsResponse]) => {
      if (!menusResponse.ok || !locationsResponse.ok) throw new Error("Unable to load menu options.");
      setMenus((await menusResponse.json() as { id: string; name: string }[]).map(({ id, name }) => ({ id, name })));
      setLocations((await locationsResponse.json() as { id: string; name: string }[]).map(({ id, name }) => ({ id, name })));
    }).catch((error: Error) => setMessage(error.message));
    if (!pageId) return;
    void fetch(`/api/pages/${pageId}`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load this page.");
      const page = await response.json();
      setPageTitle(page.title);
      setSlug(page.slug);
      setBlocks((page.blocks as Array<{ id: string; type: BlockType; props: Partial<Block> }>).filter((block) => block.type in blockDefinitions).map((block) => ({ id: block.id, type: block.type, title: block.props.title ?? "", content: block.props.content ?? "", mediaType: block.props.mediaType, mediaUrl: block.props.mediaUrl, span: block.props.span ?? 12, menuId: block.props.menuId ?? null, menuLocationId: block.props.menuLocationId ?? null })));
    }).catch((error: Error) => setMessage(error.message));
  }, [pageId]);

  async function saveDraft() {
    const input = { title: pageTitle, slug, blocks: blocks.map(({ id, type, title, content, mediaType, mediaUrl, span, menuId, menuLocationId }) => ({ id, type, props: { title, content, mediaType: mediaType ?? null, mediaUrl: mediaUrl ?? null, span, menuId: menuId ?? null, menuLocationId: menuLocationId ?? null } })) };
    const response = await fetch(pageId ? `/api/pages/${pageId}` : "/api/pages", { method: pageId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Unable to save draft."); return; }
    setMessage(pageId ? "Draft saved." : "Page created.");
    if (!pageId && body.id) router.replace(`/admin/editor/${body.id}`);
  }

  function moveBlock(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setBlocks((current) => {
      const from = current.findIndex((block) => block.id === draggedId);
      const to = current.findIndex((block) => block.id === targetId);
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedId(null);
  }

  function addBlock(type: BlockType) {
    const definition = blockDefinitions[type];
    setBlocks((current) => [...current, { id: `${type}-${Date.now()}`, type, title: `New ${definition.label.toLowerCase()} block`, content: "", mediaType: type === "hero" ? "image" : undefined, mediaUrl: type === "hero" ? "" : undefined, span: definition.defaultSpan, menuId: null, menuLocationId: null }]);
  }

  function updateBlock(id: string, changes: Partial<Block>) {
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...changes } : block)));
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <section aria-label="Page canvas" className="rounded-2xl border border-dashed border-ink/20 bg-white/70 p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink/45">
          <span>12-column grid</span><span>{blocks.length} blocks</span>
        </div>
        <div className="grid grid-cols-12 gap-3">
          {blocks.map((block) => (
            <article
              key={block.id}
              draggable
              onDragStart={() => setDraggedId(block.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveBlock(block.id)}
              className="group col-span-12 cursor-grab rounded-xl border border-ink/10 bg-white p-5 shadow-sm active:cursor-grabbing"
              style={{ gridColumn: `span ${block.span} / span ${block.span}` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-coral">{blockDefinitions[block.type].label}</span>
                  <label className="mt-2 block">
                    <span className="sr-only">Block title</span>
                    <input
                      className="focus-ring w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-serif text-2xl hover:border-ink/10 focus:border-ink/20"
                      value={block.title}
                      onChange={(event) => updateBlock(block.id, { title: event.target.value })}
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="sr-only">Block content</span>
                    <textarea className="focus-ring w-full resize-y rounded-lg border border-ink/10 px-3 py-2 text-sm leading-6 text-ink/70" rows={2} value={block.content} onChange={(event) => updateBlock(block.id, { content: event.target.value })} />
                  </label>
                </div>
                <span className="rounded bg-mist px-2 py-1 text-[10px] font-semibold text-ink/60 opacity-0 transition group-hover:opacity-100">Drag</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3 text-xs text-ink/50">
                <span>{blockDefinitions[block.type].description}</span>
                <div className="flex items-center gap-3">
                  {block.type === "hero" && (
                    <label className="flex items-center gap-2">
                      <span>Media</span>
                      <select className="focus-ring rounded border border-ink/15 bg-white px-2 py-1 text-ink" value={block.mediaType} onChange={(event) => updateBlock(block.id, { mediaType: event.target.value as "image" | "video" })}>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                      </select>
                    </label>
                  )}
                  <label className="flex items-center gap-2">
                    <span>Width</span>
                    <select className="focus-ring rounded border border-ink/15 bg-white px-2 py-1 text-ink" value={block.span} onChange={(event) => updateBlock(block.id, { span: Number(event.target.value) })}>
                      {[4, 5, 6, 7, 8, 9, 10, 12].map((span) => <option key={span} value={span}>{span}/12</option>)}
                    </select>
                  </label>
                  <button type="button" className="focus-ring font-semibold text-coral hover:text-ink" onClick={() => removeBlock(block.id)}>Remove</button>
                </div>
              </div>
              {block.type === "hero" && (
                <label className="mt-3 block text-xs text-ink/50">
                  <span className="mr-2 font-semibold">Media URL</span>
                  <input className="focus-ring mt-1 w-full rounded border border-ink/15 px-2 py-1 text-sm text-ink" placeholder="https://..." value={block.mediaUrl} onChange={(event) => updateBlock(block.id, { mediaUrl: event.target.value })} />
                </label>
              )}
              {menuBlocks.includes(block.type) && (
                <div className="mt-3 grid gap-2 border-t border-ink/10 pt-3 text-xs text-ink/50 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="font-semibold">Menu source</span>
                    <select className="focus-ring rounded border border-ink/15 bg-white px-2 py-1 text-ink" value={block.menuId ? `menu:${block.menuId}` : block.menuLocationId ? `location:${block.menuLocationId}` : "none"} onChange={(event) => {
                      const [kind, value] = event.target.value.split(":");
                      updateBlock(block.id, { menuId: kind === "menu" ? value : null, menuLocationId: kind === "location" ? value : null });
                    }}>
                      <option value="none">No menu</option>
                      <optgroup label="Specific menu">{menus.map((menu) => <option key={menu.id} value={`menu:${menu.id}`}>{menu.name}</option>)}</optgroup>
                      <optgroup label="Site location">{locations.map((location) => <option key={location.id} value={`location:${location.id}`}>{location.name}</option>)}</optgroup>
                    </select>
                  </label>
                  <p className="self-end leading-5">A specific menu overrides a location assignment.</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
      <Card className="h-fit">
        <h2 className="font-semibold">Page settings</h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
            Title
            <input required className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
            URL slug
            <input required className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={slug} onChange={(event) => setSlug(event.target.value)} />
          </label>
        </div>
        <h2 className="mt-7 font-semibold">Add a block</h2>
        <p className="mt-1 text-sm text-ink/55">Choose a block to add to the canvas</p>
        <div className="mt-5 grid gap-2">
          {(Object.keys(blockDefinitions) as BlockType[]).map((type) => <Button key={type} title={blockDefinitions[type].description} className="w-full justify-start bg-ink hover:bg-ink/90" onClick={() => addBlock(type)}>+ {blockDefinitions[type].label}</Button>)}
        </div>
        <button type="button" onClick={() => void saveDraft()} className="mt-6 w-full rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95f43]">Save draft</button>
        {message && <p role="status" className="mt-3 text-sm text-ink/60">{message}</p>}
        <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/50">Draft changes are saved through the protected page API.</p>
      </Card>
    </div>
  );
}
