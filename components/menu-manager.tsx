"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";

type Menu = {
  id: string;
  name: string;
  slug: string;
  items: { id: string; label: string; href: string; position: number }[];
};

export function MenuManager() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("Loading menus...");

  async function loadMenus() {
    const response = await fetch("/api/menus");
    if (!response.ok) throw new Error("Unable to load menus.");
    setMenus(await response.json() as Menu[]);
    setMessage("");
  }

  useEffect(() => {
    void loadMenus().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load menus."));
  }, []);

  async function createMenu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/menus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, items: [] })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(result?.error ?? "Unable to create menu.");
      return;
    }
    setName("");
    setSlug("");
    await loadMenus();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-4">
        {menus.length === 0 && !message && <Card><p className="text-ink/60">No menus have been created yet.</p></Card>}
        {menus.map((menu) => (
          <Card key={menu.id} className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl">{menu.name}</h2>
              <p className="mt-1 text-sm text-ink/55">/{menu.slug} · {menu.items.length} {menu.items.length === 1 ? "item" : "items"}</p>
            </div>
            <Link href={`/admin/navigation/${menu.id}`} className="focus-ring rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-ink/90">Edit menu</Link>
          </Card>
        ))}
        {message && <p role="status" className="text-sm text-ink/60">{message}</p>}
      </div>
      <Card className="h-fit">
        <h2 className="font-serif text-2xl">Add a menu</h2>
        <p className="mt-1 text-sm text-ink/55">Create a menu before adding navigation links.</p>
        <form className="mt-5 grid gap-4" onSubmit={(event) => void createMenu(event)}>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
            Name
            <input required value={name} onChange={(event) => setName(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
            URL slug
            <input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" />
          </label>
          <Button type="submit">Create menu</Button>
        </form>
      </Card>
    </div>
  );
}
