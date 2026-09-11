"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function PageActions({ id, status, isHome = false }: { id: string; status: string; isHome?: boolean }) {
  const router = useRouter();
  async function act(action: string) {
    if (action === "delete" && !window.confirm("Delete this page permanently?")) return;
    const response = action === "delete"
      ? await fetch(`/api/pages/${id}`, { method: "DELETE" })
      : await fetch(`/api/pages/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (response.ok) router.refresh();
  }
  return <div className="flex flex-wrap gap-2"><a href={`/admin/editor/${id}`} className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold hover:bg-mist">Edit</a>{status !== "PUBLISHED" && <Button type="button" className="px-4 py-2" onClick={() => void act("publish")}>Publish</Button>}{status === "PUBLISHED" && <Button type="button" variant="secondary" className="px-4 py-2" onClick={() => void act("archive")}>Archive</Button>}{status === "ARCHIVED" && <Button type="button" variant="secondary" className="px-4 py-2" onClick={() => void act("restore")}>Restore</Button>}{status === "PUBLISHED" && !isHome && <Button type="button" variant="default" className="px-4 py-2" onClick={() => void act("home")}>Set home</Button>}<button type="button" className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold hover:bg-mist" onClick={() => void act("duplicate")}>Duplicate</button><button type="button" onClick={() => void act("delete")} className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Delete</button></div>;
}
