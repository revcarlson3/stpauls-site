"use client";

import { useEffect, useState } from "react";

type Church = { id: string; name: string; slug: string };

export default function GlobalAdminControlPlane() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState("");
  useEffect(() => {
    void Promise.all([fetch("/api/global-admin/churches"), fetch("/api/global-admin/context")]).then(async ([churchesResponse, contextResponse]) => {
      if (churchesResponse.ok) setChurches(await churchesResponse.json());
      if (contextResponse.ok) setSelectedChurchId((await contextResponse.json()).church?.id ?? "");
    });
  }, []);
  async function selectChurch(churchId: string) {
    const response = await fetch("/api/global-admin/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ churchId }) });
    if (response.ok) setSelectedChurchId(churchId);
  }
  return <main className="min-h-screen bg-sand px-6 py-12"><div className="mx-auto max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Bridge administration</p><h1 className="mt-3 font-serif text-4xl">Select a site</h1><p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">Choose the site context before opening tenant-scoped tools. No site is selected implicitly.</p><label className="mt-8 grid max-w-md gap-2 text-sm font-semibold">Site<select value={selectedChurchId} onChange={(event) => void selectChurch(event.target.value)} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2"><option value="">Select a site</option>{churches.map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}</select></label>{selectedChurchId && <p className="mt-4 text-sm font-semibold text-ink/70">Site context selected. Tenant-scoped actions may now require additional reauthentication.</p>}</div></main>;
}
