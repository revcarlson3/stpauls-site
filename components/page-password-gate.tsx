"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function PagePasswordGate({ pageId, title }: { pageId: string; title: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const response = await fetch("/api/page-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, password })
    }).catch(() => null);
    setSubmitting(false);
    if (!response?.ok) {
      const result = await response?.json().catch(() => ({}));
      setMessage(result?.error ?? "Unable to unlock this page.");
      return;
    }
    router.refresh();
  }

  return <main className="mx-auto w-full max-w-md px-4 py-16">
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-coral">Protected page</p>
        <h1 className="mt-2 font-serif text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-ink/65">Enter the page password to continue.</p>
      </div>
      <label className="grid gap-1 text-sm font-semibold">Password
        <input required autoFocus type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" />
      </label>
      <button disabled={submitting} type="submit" className="focus-ring rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Checking…" : "View page"}</button>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    </form>
  </main>;
}
