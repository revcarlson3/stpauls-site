"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Container } from "@/components/ui";

export default function RegisterPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Registration could not be completed.");
    else setMessage(result.message);
  }

  return (
    <main className="py-16">
      <Container className="max-w-xl">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Join the community</p>
          <h1 className="mt-3 font-serif text-4xl">Create an account</h1>
          <p className="mt-3 text-sm leading-6 text-ink/60">Use your name and email. A church code connects you to an existing member profile when the details match.</p>
          <form className="mt-8 grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">First name<input required name="firstName" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
              <label className="grid gap-1 text-sm font-semibold">Last name<input required name="lastName" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            </div>
            <label className="grid gap-1 text-sm font-semibold">Email<input required type="email" name="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Church code <span className="font-normal text-ink/50">(optional)</span><input name="churchCode" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            {error && <p role="alert" className="text-sm font-semibold text-coral">{error}</p>}
            {message && <p role="status" className="text-sm font-semibold text-ink">{message}</p>}
            <Button type="submit">Create account</Button>
          </form>
        </Card>
      </Container>
    </main>
  );
}

