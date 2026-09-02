"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

type Menu = {
  name: string;
  slug: string;
  items: { id: string; label: string; href: string; position: number }[];
};

export function MenuEditor({ id }: { id: string }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("Loading menu...");

  useEffect(() => {
    void fetch(`/api/menus/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load menu.");
        const loaded = await response.json() as Menu;
        setMenu(loaded);
        setName(loaded.name);
        setSlug(loaded.slug);
        setMessage("");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load menu."));
  }, [id]);

  async function saveMenu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch(`/api/menus/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(result?.error ?? "Unable to save menu.");
      return;
    }
    setMenu(await response.json() as Menu);
    setMessage("Menu saved.");
  }

  if (!menu && message === "Loading menu...") return <p role="status" className="text-sm text-ink/60">{message}</p>;
  if (!menu) return <Card><p role="alert" className="text-sm text-coral">{message}</p></Card>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="font-serif text-2xl">Menu items</h2><p className="mt-1 text-sm text-ink/55">Links will be added and reordered here next.</p></div>
        </div>
        <div className="mt-5 grid gap-2">
          {menu.items.length === 0 && <p className="rounded-lg bg-mist p-4 text-sm text-ink/60">This menu has no items yet.</p>}
          {menu.items.map((item) => <div key={item.id} className="flex justify-between rounded-lg border border-ink/10 px-4 py-3 text-sm"><span>{item.label}</span><span className="text-ink/50">{item.href}</span></div>)}
        </div>
      </Card>
      <Card className="h-fit">
        <h2 className="font-serif text-2xl">Menu settings</h2>
        <form className="mt-5 grid gap-4" onSubmit={(event) => void saveMenu(event)}>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" /></label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" /></label>
          <Button type="submit">Save menu</Button>
          {message && <p role="status" className="text-sm text-ink/60">{message}</p>}
          <Link href="/admin/navigation" className="text-center text-sm font-semibold text-coral hover:underline">Back to menus</Link>
        </form>
      </Card>
    </div>
  );
}
