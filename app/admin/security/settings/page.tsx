"use client";

import { useEffect, useState } from "react";
import { Card, Container } from "@/components/ui";

export default function SecuritySettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [attempts, setAttempts] = useState(5);
  const [minutes, setMinutes] = useState(15);
  const [captchaMode, setCaptchaMode] = useState("off");
  const [emailMfa, setEmailMfa] = useState(false);
  const [smsMfa, setSmsMfa] = useState(false);
  const [authenticatorMfa, setAuthenticatorMfa] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/security-settings").then((response) => response.json()).then((settings) => { setEnabled(settings.loginProtectionEnabled); setAttempts(settings.maxFailedAttempts); setMinutes(settings.lockoutMinutes); setCaptchaMode(settings.captchaMode); setEmailMfa(settings.emailMfaEnabled); setSmsMfa(settings.smsMfaEnabled); setAuthenticatorMfa(settings.authenticatorMfaEnabled); }).catch(() => setMessage("Unable to load settings.")); }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/security-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loginProtectionEnabled: enabled, maxFailedAttempts: attempts, lockoutMinutes: minutes, captchaMode, emailMfaEnabled: emailMfa, smsMfaEnabled: smsMfa, authenticatorMfaEnabled: authenticatorMfa }) });
    setMessage(response.ok ? "Settings saved." : "Unable to save settings.");
  }
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Security</p><h1 className="mt-2 font-serif text-4xl">Settings</h1><Card className="mt-8 max-w-2xl"><form className="grid gap-5" onSubmit={save}><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable login protection</label><label className="grid gap-1 text-sm font-semibold">Failed attempts before lockout<input type="number" min={1} max={20} value={attempts} onChange={(event) => setAttempts(Number(event.target.value))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Lockout time (minutes)<input type="number" min={1} max={1440} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Human check<select value={captchaMode} onChange={(event) => setCaptchaMode(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="off">Off</option><option value="challenge">Built-in challenge</option><option value="recaptcha-v3">Google reCAPTCHA v3 (requires site keys)</option></select></label><fieldset className="grid gap-3 border-t border-ink/10 pt-4"><legend className="font-semibold">Available account 2FA methods</legend><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={emailMfa} onChange={(event) => setEmailMfa(event.target.checked)} /> Email verification codes</label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={smsMfa} onChange={(event) => setSmsMfa(event.target.checked)} /> Text message verification codes</label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={authenticatorMfa} onChange={(event) => setAuthenticatorMfa(event.target.checked)} /> Authenticator apps (TOTP)</label><p className="text-xs leading-5 text-ink/50">These switches make methods available for enrollment. They do not force 2FA until an account has completed enrollment.</p></fieldset><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white" type="submit">Save settings</button>{message && <p role="status" className="text-sm">{message}</p>}</form></Card></Container></main>;
}
