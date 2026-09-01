"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Container } from "@/components/ui";

export default function PasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/register/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Password setup failed.");
    else setMessage(result.message);
  }

  return (
    <main className="py-16">
      <Container className="max-w-xl">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Email verified</p>
          <h1 className="mt-3 font-serif text-4xl">Set your password</h1>
          <form className="mt-8 grid gap-4" onSubmit={submit}>
            <label className="grid gap-1 text-sm font-semibold">Password<input required minLength={12} type="password" autoComplete="new-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <p role="alert" className="text-sm font-semibold text-coral">{error}</p>}
            {message && <p role="status" className="text-sm font-semibold text-ink">{message}</p>}
            <Button type="submit">Set password</Button>
          </form>
        </Card>
      </Container>
    </main>
  );
}

