"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { Button, Card, Container } from "@/components/ui";

export default function GlobalAdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      bridge: "true",
      mfaCode: challenge ? code : undefined,
      mfaChannel: "authenticator",
      callbackUrl: "/global-admin",
      redirect: false
    });
    if (result?.error) {
      setError(result.error === "Bridge access requires MFA enrollment." ? result.error : challenge ? "That verification code was not accepted." : "Bridge credentials were not accepted.");
      return;
    }
    const session = await getSession();
    if (session?.user.mfaPending) setChallenge(true);
    else window.location.href = "/global-admin";
  }

  return <main className="grid min-h-screen place-items-center bg-sand py-8"><Container className="max-w-md" style={{ maxWidth: "28rem" }}><Card><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Bridge administration</p><h1 className="mt-3 font-serif text-4xl">Global administrator sign in</h1><p className="mt-3 text-sm leading-6 text-ink/60">This separate administration boundary requires a fresh password and MFA verification. It is not the tenant administrator sign-in.</p><form className="mt-8 grid gap-4" onSubmit={submit}><label className="grid gap-1 text-sm font-semibold">Email<input required={!challenge} type="email" autoComplete="username" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{!challenge && <label className="grid gap-1 text-sm font-semibold">Password<input required type="password" autoComplete="current-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}{challenge && <label className="grid gap-1 text-sm font-semibold">MFA verification code<input required inputMode="numeric" autoComplete="one-time-code" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={code} onChange={(event) => setCode(event.target.value)} /></label>}{error && <p role="alert" className="text-sm font-semibold text-coral">{error}</p>}<Button type="submit">{challenge ? "Verify and continue" : "Enter bridge"}</Button></form></Card></Container></main>;
}
