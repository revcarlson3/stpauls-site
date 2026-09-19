"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { Button, Card, Container } from "@/components/ui";

export default function GlobalAdminMfaSetupPage() {
  const [enrollment, setEnrollment] = useState<{ otpauthUri: string; secret: string } | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/account/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "begin" })
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to begin MFA enrollment.");
      setEnrollment(body);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!enrollment) return;
    void QRCode.toDataURL(enrollment.otpauthUri, { width: 240, margin: 2 }).then(setQrCode).catch(() => setMessage("Unable to generate the authenticator QR code."));
  }, [enrollment]);

  async function enable() {
    const response = await fetch("/api/account/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable", code })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "That authenticator code was not accepted.");
      return;
    }
    setRecoveryCodes(body.recoveryCodes);
    setMessage("MFA is enabled. Save the recovery codes, then sign in again.");
  }

  return <main className="grid min-h-screen place-items-center bg-sand py-8"><Container className="max-w-lg" style={{ maxWidth: "32rem" }}><Card><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Required setup</p><h1 className="mt-3 font-serif text-4xl">Secure your global administrator account</h1><p className="mt-3 text-sm leading-6 text-ink/60">Before you can enter global administration, enable an authenticator app and save your recovery codes.</p>{message && <p role="status" className="mt-5 rounded-lg bg-mist p-3 text-sm">{message}</p>}{enrollment && !recoveryCodes && <div className="mt-6 grid gap-4"><p className="text-sm">Scan this QR code with your authenticator app. If scanning is unavailable, enter this secret manually: <code className="break-all">{enrollment.secret}</code></p>{qrCode && <Image src={qrCode} alt="Authenticator setup QR code" width={240} height={240} unoptimized className="rounded-lg border border-ink/10" />}<label className="grid gap-1 text-sm font-semibold">Six-digit verification code<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><Button type="button" onClick={() => void enable()}>Enable MFA</Button></div>}{recoveryCodes && <div className="mt-6 grid gap-4"><p className="text-sm font-semibold">Save these recovery codes. Each can be used once:</p><code className="whitespace-pre-wrap rounded-lg bg-amber-50 p-4 text-sm">{recoveryCodes.join("\n")}</code><Button type="button" onClick={() => void signOut({ callbackUrl: "/global-admin/login" })}>Continue to global-admin sign in</Button></div>}</Card></Container></main>;
}
