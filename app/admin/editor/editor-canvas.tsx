"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { blockDefinitions, type BlockType } from "@/lib/blocks";

type Block = { id: string; type: BlockType; title: string; span: number };

const initialBlocks: Block[] = [
  { id: "hero-1", type: "hero", title: "A place to belong.", span: 12 },
  { id: "headline-1", type: "headline", title: "Make space for what matters.", span: 7 },
  { id: "news-1", type: "news", title: "Latest from St. Paul's", span: 5 }
];

export default function EditorCanvas() {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("Welcome page");
  const [slug, setSlug] = useState("welcome");

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
    setBlocks((current) => [...current, { id: `${type}-${Date.now()}`, type, title: `New ${definition.label.toLowerCase()} block`, span: definition.defaultSpan }]);
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
                </div>
                <span className="rounded bg-mist px-2 py-1 text-[10px] font-semibold text-ink/60 opacity-0 transition group-hover:opacity-100">Drag</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3 text-xs text-ink/50">
                <span>{blockDefinitions[block.type].description}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <span>Width</span>
                    <select className="focus-ring rounded border border-ink/15 bg-white px-2 py-1 text-ink" value={block.span} onChange={(event) => updateBlock(block.id, { span: Number(event.target.value) })}>
                      {[4, 5, 6, 7, 8, 9, 10, 12].map((span) => <option key={span} value={span}>{span}/12</option>)}
                    </select>
                  </label>
                  <button type="button" className="focus-ring font-semibold text-coral hover:text-ink" onClick={() => removeBlock(block.id)}>Remove</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <Card className="h-fit">
        <h2 className="font-semibold">Page settings</h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
            Title
            <input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
            URL slug
            <input className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" value={slug} onChange={(event) => setSlug(event.target.value)} />
          </label>
        </div>
        <h2 className="mt-7 font-semibold">Add a block</h2>
        <p className="mt-1 text-sm text-ink/55">Choose a block to add to the canvas</p>
        <div className="mt-5 grid gap-2">
          {(Object.keys(blockDefinitions) as BlockType[]).map((type) => <Button key={type} title={blockDefinitions[type].description} className="w-full justify-start bg-ink hover:bg-ink/90" onClick={() => addBlock(type)}>+ {blockDefinitions[type].label}</Button>)}
        </div>
        <button type="button" disabled className="mt-6 w-full cursor-not-allowed rounded-full bg-ink/20 px-5 py-3 text-sm font-semibold text-ink/50">Save draft (authentication required)</button>
        <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/50">Changes live only in this browser session. Saving will call the protected page service after a real server-side session is connected.</p>
      </Card>
    </div>
  );
}
