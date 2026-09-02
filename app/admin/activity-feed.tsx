"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";

type AuditLog = { id: string; activityType: string; summary: string; details: string | null; createdAt: string; actor: { name: string; email: string } | null };
const labels: Record<string, string> = {
  "user-created": "User created", "user-updated": "User updated", "user-deleted": "User deleted",
  "invitation-created": "Invitation created", "invitation-accepted": "Invitation accepted", "invitation-resent": "Invitation resent", "invitation-revoked": "Invitation revoked",
  "email-change-requested": "Email change requested", "email-changed": "Email changed", "sessions-revoked": "Sessions revoked",
  "group-created": "Group created", "group-updated": "Group updated", "group-deleted": "Group deleted"
};

export default function ActivityFeed() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [type, setType] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`/api/audit${type ? `?type=${encodeURIComponent(type)}` : ""}`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load activity.");
      setLogs(await response.json());
    }).catch((reason: Error) => setError(reason.message));
  }, [type]);
  return <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-serif text-2xl">Recent activity</h2><p className="mt-1 text-sm text-ink/60">Security and user-management actions from the last 100 recorded events.</p></div><label className="text-sm font-semibold">Filter activity<select value={type} onChange={(event) => setType(event.target.value)} className="focus-ring mt-1 block rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">All activity</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{error ? <p role="alert" className="mt-4 text-sm text-coral">{error}</p> : logs.length ? <div className="mt-4 grid gap-3">{logs.map((log) => <Card key={log.id} className="p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{log.summary}</p><time className="text-xs text-ink/50" dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time></div><p className="mt-1 text-xs text-ink/60">{labels[log.activityType] ?? log.activityType} · {log.actor ? `${log.actor.name} (${log.actor.email})` : "System"}</p>{log.details && <p className="mt-2 text-sm text-ink/70">{log.details}</p>}</Card>)}</div> : <p className="mt-4 rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No recorded activity.</p>}</section>;
}
