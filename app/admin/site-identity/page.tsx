"use client";

import { useEffect, useState } from "react";
import { Button, Container, Notification } from "@/components/ui";

export default function SiteIdentityPage() {
  const [siteUrl, setSiteUrl] = useState("");
  const [message, setMessage] = useState("");
  const [messageVariant, setMessageVariant] = useState<"success" | "danger">("success");

  useEffect(() => {
    void fetch("/api/site-identity").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load site identity.");
      const value = await response.json();
      setSiteUrl(typeof value.siteUrl === "string" ? value.siteUrl : "");
    }).catch((error: Error) => { setMessageVariant("danger"); setMessage(error.message); });
  }, []);

  async function save() {
    const response = await fetch("/api/site-identity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteUrl }) });
    setMessageVariant(response.ok ? "success" : "danger");
    setMessage(response.ok ? "Site URL saved." : "Unable to save site URL.");
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site Settings</p>
        <h1 className="mt-2 font-serif text-4xl">Site Identity</h1>
        <p className="mt-3 max-w-2xl text-ink/60">Set the canonical address for this site. Branding is standardized across the application.</p>
        <section className="mt-8 grid max-w-2xl gap-5 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
          <label className="grid gap-1 text-sm font-semibold">Site URL<input type="url" placeholder="https://example.org" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
          <div className="flex items-center gap-4"><Button type="button" onClick={() => void save()}>Save site URL</Button>{message && <Notification variant={messageVariant}>{message}</Notification>}</div>
        </section>
      </Container>
    </main>
  );
}
