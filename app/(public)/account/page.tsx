"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Container } from "@/components/ui";
import { signOut } from "next-auth/react";
import QRCode from "qrcode";
import Image from "next/image";

type Account = { name: string; email: string; emailVerifiedAt: string | null };
type MfaState = { available: boolean; issuer: string; enabled: boolean; recoveryCodesRemaining: number; emailAvailable: boolean; emailEnabled: boolean; emailVerified: boolean; smsAvailable: boolean; smsEnabled: boolean; phoneNumber: string | null; phoneVerified: boolean };

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [mfa, setMfa] = useState<MfaState | null>(null);
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [enrollmentQrCode, setEnrollmentQrCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaPassword, setMfaPassword] = useState("");
  const [message, setMessage] = useState("");
  const [channelCode, setChannelCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [pendingChannel, setPendingChannel] = useState<"email" | "sms" | null>(null);

  useEffect(() => {
    void fetch("/api/account").then(async (response) => {
      if (!response.ok) throw new Error("Sign in to manage your account.");
      setAccount(await response.json());
    }).catch((error: Error) => setMessage(error.message));
    void fetch("/api/account/mfa").then(async (response) => {
      if (response.ok) setMfa(await response.json());
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enrollment) {
      setEnrollmentQrCode("");
      return;
    }
    void QRCode.toDataURL(enrollment.otpauthUri, { width: 240, margin: 2 })
      .then(setEnrollmentQrCode)
      .catch(() => setMessage("Unable to generate the authenticator QR code."));
  }, [enrollment]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: email !== account?.email.toLowerCase() ? email : undefined,
        currentPassword: data.get("currentPassword") || undefined,
        newPassword: data.get("newPassword") || undefined
      })
    });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? body.message ?? "Account updated." : body.error ?? "Unable to update account.");
    if (response.ok) {
      setAccount(body);
      event.currentTarget.reset();
    }
  }

  async function signOutSessions() {
    if (!window.confirm("Sign out all other devices and browsers?")) return;
    const response = await fetch("/api/account", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      await signOut({ callbackUrl: "/admin/login" });
    } else {
      setMessage(body.error ?? "Unable to sign out sessions.");
    }
  }

  async function beginMfa() {
    const response = await fetch("/api/account/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "begin" })
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setEnrollment(body);
      setMfaCode("");
      setMessage("Scan the QR code with your authenticator app, then verify a code.");
    } else {
      setMessage(body.error ?? "Unable to start MFA enrollment.");
    }
  }

  async function enableMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/account/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable", code: mfaCode })
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setMfa((current) => current ? { ...current, enabled: true, recoveryCodesRemaining: body.recoveryCodes.length } : current);
      setEnrollment(null);
      setRecoveryCodes(body.recoveryCodes);
      setMfaCode("");
      setMessage("Authenticator MFA is enabled.");
    } else {
      setMessage(body.error ?? "Unable to enable MFA.");
    }
  }

  async function disableMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/account/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable", currentPassword: mfaPassword, code: mfaCode })
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setMfa((current) => current ? { ...current, enabled: false, recoveryCodesRemaining: 0 } : current);
      setMfaCode("");
      setMfaPassword("");
      setMessage("Authenticator MFA is disabled.");
    } else {
      setMessage(body.error ?? "Unable to disable MFA.");
    }

  }

  async function beginChannel(channel: "email" | "sms") {
      const body = channel === "email" ? { action: "begin-email" } : { action: "begin-phone", phoneNumber, currentPassword: phonePassword };
      const response = await fetch("/api/account/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error ?? "Unable to send verification code."); return; }
      setPendingChannel(channel); setChannelCode(""); setMessage(`A verification code was sent by ${channel === "email" ? "email" : "text message"}.`);
  }

  async function verifyChannel(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!pendingChannel) return;
      const response = await fetch("/api/account/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: pendingChannel === "email" ? "verify-email" : "verify-phone", code: channelCode }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error ?? "Unable to verify code."); return; }
      setMfa((current) => current ? pendingChannel === "email" ? { ...current, emailEnabled: true } : { ...current, smsEnabled: true, phoneNumber: result.phoneNumber, phoneVerified: true } : current);
      setPendingChannel(null); setChannelCode(""); setPhonePassword(""); setMessage(`${pendingChannel === "email" ? "Email" : "Text-message"} MFA is enabled.`);
  }

  return (
    <main>
      <Container className="py-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Account</p>
        <h1 className="mt-2 font-serif text-4xl">Account settings</h1>
        {account ? <>
          <form onSubmit={(event) => void save(event)} className="mt-8 grid max-w-xl gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <p className="text-sm text-ink/60">{account.email} · {account.emailVerifiedAt ? "Email verified" : "Email not verified"}</p>
            <label className="grid gap-1 text-sm font-semibold">Name<input name="name" required minLength={2} defaultValue={account.name} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Email<span className="font-normal text-ink/50">A confirmation link will be sent before this becomes your sign-in email.</span><input required type="email" name="email" defaultValue={account.email} autoComplete="email" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Current password<span className="font-normal text-ink/50">(required only when changing password)</span><input name="currentPassword" type="password" autoComplete="current-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">New password<span className="font-normal text-ink/50">(must meet the current Security Settings policy)</span><input name="newPassword" type="password" autoComplete="new-password" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
            <button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white" type="submit">Save account</button>
            {message && <p role="status" className="text-sm">{message}</p>}
          </form>
          {mfa && <section className="mt-8 max-w-xl rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className="font-serif text-2xl">Multi-factor authentication</h2>
            {!mfa.available ? <p className="mt-2 text-sm text-ink/60">Authenticator apps are not enabled by the site administrator.</p> : mfa.enabled ? <>
              <p className="mt-2 text-sm text-ink/60">Enabled. {mfa.recoveryCodesRemaining} recovery codes remain.</p>
              <form onSubmit={(event) => void disableMfa(event)} className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">Current password<input required type="password" value={mfaPassword} onChange={(event) => setMfaPassword(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Authenticator or recovery code<input required value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
                <button className="focus-ring w-fit rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral" type="submit">Disable MFA</button>
              </form>
              {recoveryCodes && <div className="mt-5 rounded-lg bg-amber-50 p-4"><p className="text-sm font-semibold">Save these recovery codes now. Each works once.</p><code className="mt-2 block whitespace-pre-wrap text-sm">{recoveryCodes.join("\n")}</code></div>}
            </> : enrollment ? <form onSubmit={(event) => void enableMfa(event)} className="mt-4 grid gap-3">
              <p className="text-sm text-ink/60">Scan this QR code with your authenticator app. Issuer: {mfa.issuer}</p>
              {enrollmentQrCode && <Image src={enrollmentQrCode} alt="Authenticator app setup QR code" width={240} height={240} unoptimized className="rounded-lg border border-ink/10" />}
              <label className="grid gap-1 text-sm font-semibold">Verification code<input required inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
              <button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white" type="submit">Verify and enable</button>
            </form> : <>
              <p className="mt-2 text-sm text-ink/60">Use an authenticator app for a six-digit login code.</p>
              <button type="button" onClick={() => void beginMfa()} className="focus-ring mt-4 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Set up authenticator app</button>
            </>}
            <div className="mt-8 border-t border-ink/10 pt-6">
              <h3 className="font-serif text-xl">Email-code MFA</h3>
              {!mfa.emailAvailable ? <p className="mt-2 text-sm text-ink/60">Email-code MFA is not enabled by the site administrator.</p> : mfa.emailEnabled ? <p className="mt-2 text-sm text-ink/60">Enabled for {account.email}.</p> : !mfa.emailVerified ? <p className="mt-2 text-sm text-ink/60">Verify your account email before enrolling this method.</p> : pendingChannel === "email" ? <form onSubmit={(event) => void verifyChannel(event)} className="mt-3 grid gap-3"><label className="grid gap-1 text-sm font-semibold">Email verification code<input required inputMode="numeric" autoComplete="one-time-code" value={channelCode} onChange={(event) => setChannelCode(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Verify email MFA</button></form> : <button type="button" onClick={() => void beginChannel("email")} className="focus-ring mt-3 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Set up email MFA</button>}
            </div>
            <div className="mt-8 border-t border-ink/10 pt-6">
              <h3 className="font-serif text-xl">Text-message MFA</h3>
              {!mfa.smsAvailable ? <p className="mt-2 text-sm text-ink/60">Text-message MFA is not configured by the site administrator.</p> : mfa.smsEnabled ? <p className="mt-2 text-sm text-ink/60">Enabled for {mfa.phoneNumber}.</p> : pendingChannel === "sms" ? <form onSubmit={(event) => void verifyChannel(event)} className="mt-3 grid gap-3"><p className="text-sm text-ink/60">Code sent to {phoneNumber}.</p><label className="grid gap-1 text-sm font-semibold">Text-message verification code<input required inputMode="numeric" autoComplete="one-time-code" value={channelCode} onChange={(event) => setChannelCode(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Verify phone</button></form> : <div className="mt-3 grid gap-3"><label className="grid gap-1 text-sm font-semibold">Phone number<span className="font-normal text-ink/50">Use international format, for example +15551234567.</span><input required type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Current password<input required type="password" value={phonePassword} onChange={(event) => setPhonePassword(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><button type="button" onClick={() => void beginChannel("sms")} className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white">Verify phone and enable MFA</button></div>}
            </div>
          </section>}
          <section className="mt-8 max-w-xl rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className="font-serif text-2xl">Sessions</h2>
            <p className="mt-2 text-sm text-ink/60">Sign out all browsers and devices. You will be returned to the login page.</p>
            <button type="button" onClick={() => void signOutSessions()} className="focus-ring mt-4 rounded-full border border-coral px-5 py-3 text-sm font-semibold text-coral hover:bg-coral hover:text-white">Sign out all sessions</button>
          </section>
        </> : <p role="alert" className="mt-6 text-sm text-coral">{message}</p>}
      </Container>
    </main>
  );
}
