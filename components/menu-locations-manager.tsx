"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

type Menu = { id: string; name: string; slug: string };
type Location = { id: string; name: string; slug: string; menu: Menu | null };

export function MenuLocationsManager() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [message, setMessage] = useState("Loading locations...");

  useEffect(() => {
    void Promise.all([fetch("/api/menu-locations"), fetch("/api/menus")])
      .then(async ([locationsResponse, menusResponse]) => {
        if (!locationsResponse.ok || !menusResponse.ok) throw new Error("Unable to load menu locations.");
        setLocations(await locationsResponse.json() as Location[]);
        const loadedMenus = await menusResponse.json() as { id: string; name: string; slug: string; items: unknown[] }[];
        setMenus(loadedMenus.map(({ id, name, slug }) => ({ id, name, slug })));
        setMessage("");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load menu locations."));
  }, []);

  async function assign(locationId: string, menuId: string | null) {
    const response = await fetch(`/api/menu-locations/${locationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ menuId }) });
    if (!response.ok) { setMessage("Unable to save menu location."); return; }
    const updated = await response.json() as Location;
    setLocations((current) => current.map((location) => location.id === updated.id ? updated : location));
    setMessage("Menu location saved.");
  }

  if (message === "Loading locations...") return <p role="status" className="text-sm text-ink/60">{message}</p>;
  if (!locations.length && message) return <Card><p role="alert" className="text-sm text-coral">{message}</p></Card>;
  return <div className="grid gap-4">{locations.map((location) => <Card key={location.id} className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl">{location.name}</h2><p className="mt-1 text-sm text-ink/55">/{location.slug} · {location.menu ? `Assigned to ${location.menu.name}` : "No menu assigned"}</p></div><div className="flex items-center gap-2"><select aria-label={`Menu for ${location.name}`} value={location.menu?.id ?? ""} onChange={(event) => void assign(location.id, event.target.value || null)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink"><option value="">No menu</option>{menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select><Button type="button" className="bg-ink hover:bg-ink/90" onClick={() => void assign(location.id, location.menu?.id ?? null)}>Save</Button></div></Card>)}{message && <p role="status" className="text-sm text-ink/60">{message}</p>}</div>;
}
