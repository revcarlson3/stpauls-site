"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button, Card, Container } from "@/components/ui";

export default function PlatformSignupPage() {
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError("");
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/platform/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Signup could not be started."); else { setMessage(result.message); event.currentTarget.reset(); }
  }
  return <main className="min-h-screen bg-sand py-16"><Container className="max-w-xl"><Card><Link href="/" className="text-sm font-semibold text-coral hover:underline">← Back to mychurch.one</Link><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Start your church</p><h1 className="mt-3 font-serif text-4xl">Create a pending account</h1><p className="mt-3 text-sm leading-6 text-ink/60">We’ll reserve your onboarding request for verification. No payment is taken and no subscription is marked successful from this form.</p><form className="mt-8 grid gap-4" onSubmit={submit}><label className="grid gap-1 text-sm font-semibold">Contact name<input required name="contactName" maxLength={120} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Church name<input required name="churchName" maxLength={160} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Email<input required type="email" name="email" maxLength={254} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Password<input required type="password" name="password" minLength={12} autoComplete="new-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Promo code <span className="font-normal text-ink/55">(optional)<input name="promoCode" maxLength={64} className="focus-ring mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 font-normal" /></span></label>{error && <p role="alert" className="text-sm font-semibold text-coral">{error}</p>}{message && <p role="status" className="text-sm font-semibold text-ink">{message}</p>}<Button type="submit">Begin onboarding</Button></form></Card></Container></main>;
}
