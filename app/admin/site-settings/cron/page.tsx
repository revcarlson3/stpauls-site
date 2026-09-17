"use client";

import { useState } from "react";
import { Container } from "@/components/ui";

const membershipCronCommand = "0 2 1 9 * cd /path/to/stpauls-site && npm run membership:advance-grades >> /path/to/stpauls-site/logs/membership-cron.log 2>&1";
const reportCronCommand = "*/5 * * * * curl -fsS -X POST -H \"Authorization: Bearer YOUR_REPORT_AUTOMATION_CRON_SECRET\" https://your-domain.example/api/report-automations/process >> /path/to/report-automation-cron.log 2>&1";

function CronCommand({ label, description, command, note }: { label: string; description: string; command: string; note: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }
  return <section className="grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
    <div><h2 className="font-serif text-2xl">{label}</h2><p className="mt-2 text-sm text-ink/60">{description}</p></div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start"><textarea readOnly value={command} aria-label={`${label} cron command`} className="focus-ring min-h-24 flex-1 rounded-lg border border-ink/15 bg-ink/[0.03] p-3 font-mono text-xs leading-5 text-ink/75" /><button type="button" onClick={() => void copy()} className="focus-ring shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">{copied ? "Copied" : "Copy command"}</button></div>
    <p className="text-xs text-ink/55">{note}</p>
  </section>;
}

export default function CronSettingsPage() {
  return <main><Container className="py-10 sm:py-14">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Administration</p>
    <h1 className="mt-2 font-serif text-4xl">Cron</h1>
    <p className="mt-3 max-w-3xl text-ink/60">Use these commands with your hosting provider&apos;s cron service. Replace placeholder paths, domain, and secret values before saving them.</p>
    <div className="mt-8 grid gap-6 lg:max-w-5xl">
      <CronCommand label="Membership grade advancement" description="Advances school-age member grade levels once each September." command={membershipCronCommand} note="This command is idempotent for each school year, so rerunning it does not advance grades twice." />
      <CronCommand label="Report automation processor" description="Claims due email report automations and delivers their queued runs." command={reportCronCommand} note="Set REPORT_AUTOMATION_CRON_SECRET to the same value used in YOUR_REPORT_AUTOMATION_CRON_SECRET. Running every five minutes gives scheduled reports dependable timing; the request-driven scheduler remains available as a fallback." />
    </div>
  </Container></main>;
}
