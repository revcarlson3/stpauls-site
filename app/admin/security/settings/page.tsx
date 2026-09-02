"use client";

import { useEffect, useState } from "react";
import { Card, Container } from "@/components/ui";

export default function SecuritySettingsPage() {
  const [enabled, setEnabled] = useState(true);
  const [attempts, setAttempts] = useState(5);
  const [minutes, setMinutes] = useState(15);
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/security-settings").then((response) => response.json()).then((settings) => { setEnabled(settings.loginProtectionEnabled); setAttempts(settings.maxFailedAttempts); setMinutes(settings.lockoutMinutes); }).catch(() => setMessage("Unable to load settings.")); }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/security-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loginProtectionEnabled: enabled, maxFailedAttempts: attempts, lockoutMinutes: minutes }) });
    setMessage(response.ok ? "Settings saved." : "Unable to save settings.");
  }
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Security</p><h1 className="mt-2 font-serif text-4xl">Settings</h1><Card className="mt-8 max-w-2xl"><form className="grid gap-5" onSubmit={save}><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable login protection</label><label className="grid gap-1 text-sm font-semibold">Failed attempts before lockout<input type="number" min={1} max={20} value={attempts} onChange={(event) => setAttempts(Number(event.target.value))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Lockout time (minutes)<input type="number" min={1} max={1440} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><button className="focus-ring w-fit rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white" type="submit">Save settings</button>{message && <p role="status" className="text-sm">{message}</p>}</form></Card></Container></main>;
}
