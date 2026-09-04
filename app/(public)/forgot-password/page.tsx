"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Container } from "@/components/ui";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/account-recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const body = await response.json().catch(() => ({}));
    setMessage(body.message ?? body.error ?? "Unable to process the password reset request.");
  }
  return <main className="min-h-screen py-16"><Container className="max-w-lg"><Card><h1 className="font-serif text-4xl">Recover your account</h1><p className="mt-3 text-sm text-ink/60">Enter your email address and we will send a password reset link if an account exists.</p><form className="mt-8 grid gap-4" onSubmit={submit}><label className="grid gap-1 text-sm font-semibold">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><div className="flex items-center justify-between gap-4"><Button type="submit">Send reset link</Button><button type="button" onClick={() => router.back()} className="focus-ring rounded-full border border-ink/20 px-5 py-3 text-sm font-semibold text-ink/70">Cancel</button></div>{message && <p role="status" className="text-sm">{message}</p>}</form></Card></Container></main>;
}
