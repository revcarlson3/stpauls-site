"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Container } from "@/components/ui";

export default function AccountPage() {
  const [account, setAccount] = useState<{ name: string; email: string; emailVerifiedAt: string | null } | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/account").then(async (response) => { if (!response.ok) throw new Error("Sign in to manage your account."); setAccount(await response.json()); }).catch((error: Error) => setMessage(error.message)); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), email: email !== account?.email.toLowerCase() ? email : undefined, currentPassword: data.get("currentPassword") || undefined, newPassword: data.get("newPassword") || undefined }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? body.message ?? "Account updated." : body.error ?? "Unable to update account.");
    if (response.ok) { setAccount(body); event.currentTarget.reset(); }
  }
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Account</p><h1 className="mt-2 font-serif text-4xl">Account settings</h1>{account ? <form onSubmit={(event) => void save(event)} className="mt-8 grid max-w-xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"><p className="text-sm text-ink/60">{account.email} · {account.emailVerifiedAt ? "Email verified" : "Email not verified"}</p><label className="grid gap-1 text-sm font-semibold">Name<input name="name" required minLength={2} defaultValue={account.name} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Email<span className="font-normal text-ink/50">A confirmation link will be sent before this becomes your sign-in email.</span><input required type="email" name="email" defaultValue={account.email} autoComplete="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Current password<span className="font-normal text-ink/50">(required only when changing password)</span><input name="currentPassword" type="password" autoComplete="current-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">New password<span className="font-normal text-ink/50">(must meet the current Security Settings policy)</span><input name="newPassword" type="password" autoComplete="new-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white" type="submit">Save account</button>{message && <p role="status" className="text-sm">{message}</p>}</form> : <p role="alert" className="mt-6 text-sm text-coral">{message}</p>}</Container></main>;
}
