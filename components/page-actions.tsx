"use client";

import { useRouter } from "next/navigation";

export function PageActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  async function act(action: string) {
    if (action === "delete" && !window.confirm("Delete this page permanently?")) return;
    const response = action === "delete"
      ? await fetch(`/api/pages/${id}`, { method: "DELETE" })
      : await fetch(`/api/pages/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (response.ok) router.refresh();
  }
  return <div className="flex flex-wrap gap-2"><a href={`/admin/editor/${id}`} className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold hover:bg-mist">Edit</a>{status !== "PUBLISHED" && <button type="button" onClick={() => void act("publish")} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Publish</button>}{status === "PUBLISHED" && <button type="button" onClick={() => void act("archive")} className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold">Archive</button>}<button type="button" onClick={() => void act("delete")} className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Delete</button></div>;
}
