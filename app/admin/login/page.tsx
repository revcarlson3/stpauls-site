"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { Button, Card, Container } from "@/components/ui";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(false);
  const [mfaChannel, setMfaChannel] = useState<"authenticator" | "email" | "sms">("authenticator");
  const [mfaChannels, setMfaChannels] = useState<Array<"authenticator" | "email" | "sms">>([]);
  useEffect(() => { void fetch("/api/auth/captcha").then((response) => response.json()).then(setCaptcha).catch(() => undefined); }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      rememberMe: String(rememberMe),
      mfaCode: mfaChallenge ? mfaCode : undefined,
      mfaChannel: mfaChallenge ? mfaChannel : undefined,
      captchaToken: captcha?.token,
      captchaAnswer,
      callbackUrl: "/",
      redirect: false
    });
    if (result?.error) setError(mfaChallenge ? "That verification code was not accepted." : "Email or password was not accepted.");
    else if (mfaChallenge && trustDevice) {
      await fetch("/api/account/mfa/trusted-device", { method: "POST" });
      if (result?.url) window.location.href = result.url;
    } else if (result?.url) {
      const session = await getSession();
      if (session?.user.mfaPending) {
        setMfaChallenge(true);
        setMfaCode("");
        setMfaChannel(session.user.mfaPendingChannel ?? "authenticator");
        setMfaChannels(session.user.mfaAvailableChannels ?? [session.user.mfaPendingChannel ?? "authenticator"]);
      } else {
        window.location.href = result.url;
      }
    }
  }

  return (
    <main className="min-h-screen py-16">
      <Container className="max-w-lg">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site studio</p>
          <h1 className="mt-3 font-serif text-4xl">Sign in</h1>
          <p className="mt-3 text-sm leading-6 text-ink/60">{mfaChallenge ? mfaChannel === "email" ? "Enter the six-digit code sent to your email address." : mfaChannel === "sms" ? "Enter the six-digit code sent by text message." : "Enter the six-digit code from your authenticator app, or use one of your recovery codes." : "Use an account provisioned by an administrator. Your sign-in can be remembered for 60 days unless you sign out or clear your browser data. Five failed attempts within 15 minutes temporarily lock the account."}</p>
          <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-1 text-sm font-semibold">Email<input required type="email" autoComplete="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {!mfaChallenge && <label className="grid gap-1 text-sm font-semibold">Password<input required type="password" autoComplete="current-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Remember me for 60 days</label>
            {mfaChallenge && <><label className="grid gap-1 text-sm font-semibold">Verification code<input required inputMode="numeric" autoComplete="one-time-code" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} /> Trust this device when allowed by site policy</label></>}
            {captcha && <label className="grid gap-1 text-sm font-semibold">Human check: {captcha.question}<input required inputMode="numeric" value={captchaAnswer} onChange={(event) => setCaptchaAnswer(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>}
            {error && <p role="alert" className="text-sm font-semibold text-coral">{error}</p>}
            <Button type="submit">Sign in</Button>
            <Link href="/forgot-password" className="text-center text-sm font-semibold text-coral hover:underline">Forgot your password?</Link>
          </form>
        </Card>
      </Container>
    </main>
  );
}
