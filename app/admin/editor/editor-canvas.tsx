"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

type BlockType = "hero" | "text" | "event";
type Block = { id: string; type: BlockType; title: string; span: number };

const initialBlocks: Block[] = [
  { id: "hero-1", type: "hero", title: "A place to belong.", span: 12 },
  { id: "text-1", type: "text", title: "Make space for what matters.", span: 7 },
  { id: "event-1", type: "event", title: "Sunday gathering", span: 5 }
];

const labels: Record<BlockType, string> = { hero: "Hero", text: "Text", event: "Event" };

export default function EditorCanvas() {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [draggedId, setDraggedId] = useState<string | null>(null);

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
    setBlocks((current) => [...current, { id: `${type}-${Date.now()}`, type, title: `New ${labels[type].toLowerCase()} block`, span: type === "hero" ? 12 : 6 }]);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
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
              className="group col-span-12 cursor-grab rounded-xl border border-ink/10 bg-white p-5 shadow-sm active:cursor-grabbing sm:col-span-12"
              style={{ gridColumn: `span ${block.span} / span ${block.span}` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div><span className="text-xs font-semibold uppercase tracking-wider text-coral">{labels[block.type]}</span><h2 className="mt-2 font-serif text-2xl">{block.title}</h2></div>
                <span className="rounded bg-mist px-2 py-1 text-[10px] font-semibold text-ink/60 opacity-0 transition group-hover:opacity-100">Drag</span>
              </div>
              <p className="mt-4 text-sm text-ink/50">Drop another block here to reorder</p>
            </article>
          ))}
        </div>
      </section>
      <Card className="h-fit">
        <h2 className="font-semibold">Add a block</h2>
        <p className="mt-1 text-sm text-ink/55">Prototype controls</p>
        <div className="mt-5 grid gap-2">
          {(Object.keys(labels) as BlockType[]).map((type) => <Button key={type} className="w-full justify-start bg-ink hover:bg-ink/90" onClick={() => addBlock(type)}>+ {labels[type]}</Button>)}
        </div>
        <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/50">Changes live only in this browser session. Persistence and authorization are intentionally not wired yet.</p>
      </Card>
    </div>
  );
}

