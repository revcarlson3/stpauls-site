"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Card, Container } from "@/components/ui";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/admin/editor",
      redirect: false
    });
    if (result?.error) setError("Email or password was not accepted.");
    else if (result?.url) window.location.href = result.url;
  }

  return (
    <main className="min-h-screen py-16">
      <Container className="max-w-lg">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site studio</p>
          <h1 className="mt-3 font-serif text-4xl">Sign in</h1>
          <p className="mt-3 text-sm leading-6 text-ink/60">Use an account provisioned by an administrator. Your sign-in will be remembered for 60 days unless you sign out or clear your browser data.</p>
          <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-1 text-sm font-semibold">Email<input required type="email" autoComplete="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="grid gap-1 text-sm font-semibold">Password<input required type="password" autoComplete="current-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <p role="alert" className="text-sm font-semibold text-coral">{error}</p>}
            <Button type="submit">Sign in</Button>
          </form>
        </Card>
      </Container>
    </main>
  );
}
