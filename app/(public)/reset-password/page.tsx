"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Container } from "@/components/ui";

export default function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/account-recovery/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const body = await response.json();
    setMessage(body.message ?? body.error);
  }
  return <main className="min-h-screen py-16"><Container className="max-w-lg"><Card><h1 className="font-serif text-4xl">Reset password</h1><form className="mt-8 grid gap-4" onSubmit={submit}><label className="grid gap-1 text-sm font-semibold">New password<input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><Button type="submit">Update password</Button>{message && <p role="status" className="text-sm">{message}</p>}</form></Card></Container></main>;
}
