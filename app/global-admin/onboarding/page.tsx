"use client";

import { useEffect, useState } from "react";
import { Button, Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

type Onboarding = { status: string; currentStep: string; completion: { siteIdentity: boolean; modules: boolean; security: boolean; completedAt: string | null } };
const steps = ["ACCOUNT", "SITE_IDENTITY", "MODULES", "SECURITY", "COMPLETE"];

export default function GlobalAdminOnboardingPage() {
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/global-admin/onboarding", { cache: "no-store" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error ?? "Unable to load onboarding.");
    setOnboarding(value.onboarding);
  }
  useEffect(() => { void load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load onboarding.")); }, []);
  async function save() {
    if (!onboarding) return;
    setError(""); setMessage("");
    const response = await fetch("/api/global-admin/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentStep: onboarding.currentStep, siteIdentityDone: onboarding.completion.siteIdentity, modulesDone: onboarding.completion.modules, securityDone: onboarding.completion.security }) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) { setError(response.status === 428 ? "Recent bridge reauthentication is required." : value.error ?? "Unable to update onboarding."); return; }
    setOnboarding(value.onboarding); setMessage("Onboarding progress saved.");
  }
  if (!onboarding) return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container><div className="flex justify-end"><GlobalAdminBackLink /></div>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}<Card className="mt-8 p-6 text-sm text-ink/60">Select a site with an onboarding record to continue.</Card></Container></main>;
  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Selected site</p><h1 className="mt-2 font-serif text-4xl">Onboarding</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Advance setup in order. Changes require recent bridge reauthentication and respect the selected site&apos;s lifecycle.</p></div><GlobalAdminBackLink /></div>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}{message && <Notification variant="success" className="mt-6">{message}</Notification>}<Card className="mt-8 grid max-w-3xl gap-6 p-6 sm:p-8"><div className="grid gap-1"><span className="text-xs font-semibold uppercase tracking-wide text-ink/45">Status</span><strong>{onboarding.status}</strong></div><label className="grid gap-2 text-sm font-semibold">Current step<select value={onboarding.currentStep} onChange={(event) => setOnboarding({ ...onboarding, currentStep: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal">{steps.map((step) => <option key={step} value={step}>{step.replace("_", " ")}</option>)}</select></label><div className="grid gap-3">{(["siteIdentity", "modules", "security"] as const).map((key) => <label key={key} className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={onboarding.completion[key]} onChange={(event) => setOnboarding({ ...onboarding, completion: { ...onboarding.completion, [key]: event.target.checked } })} />{key === "siteIdentity" ? "Site identity complete" : key === "modules" ? "Modules complete" : "Security complete"}</label>)}</div><Button type="button" onClick={() => void save()}>Save onboarding</Button></Card></Container></main>;
}
