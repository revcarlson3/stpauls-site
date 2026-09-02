"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/ui";

export default function InvitePage() {
  const token = useSearchParams().get("token") ?? "";
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const response = await fetch("/api/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Account created. You can now sign in." : body.error ?? "Unable to accept invitation.");
  }
  return <main><Container className="py-16"><h1 className="font-serif text-4xl">Accept invitation</h1>{token ? <form onSubmit={(event) => void submit(event)} className="mt-8 grid max-w-lg gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><label className="grid gap-1 text-sm font-semibold">Create password<input required type="password" name="password" autoComplete="new-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/50">Your password must meet the site&apos;s current security policy.</span></label><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Create account</button>{message && <p role="status" className="text-sm">{message}</p>}</form> : <p className="mt-5 text-coral">This invitation link is missing its token.</p>}</Container></main>;
}
