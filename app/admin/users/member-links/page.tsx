"use client";

import { useEffect, useState } from "react";
import { Card, Container } from "@/components/ui";

type Field = { fieldKey: string; label: string; enabled: boolean };
type RequestItem = {
  id: string; requestedFirstName: string; requestedLastName: string; requestedEmail: string;
  user: { name: string; email: string; emailVerifiedAt: string | null };
  suggestedMatch: { id: string; firstName: string; lastName: string; email: string | null; family: { lastName: string }; matchScore: number; memberLink: { user: { name: string; email: string } } | null } | null;
};

export default function MemberLinksPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/users/member-links");
    const body = await response.json();
    if (response.ok) { setRequests(body.requests); setFields(body.fields); }
    else setMessage(body.error ?? "Unable to load requests.");
  }
  useEffect(() => { void load(); }, []);

  async function decide(item: RequestItem, action: "approve" | "decline", override = false) {
    const response = await fetch("/api/users/member-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: item.id, action, individualId: item.suggestedMatch?.id, override }) });
    const body = await response.json();
    setMessage(response.ok ? "Membership link request updated." : body.error ?? "Unable to update request.");
    if (response.ok) void load();
  }
  async function toggle(field: Field) {
    const response = await fetch("/api/users/member-links", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fieldKey: field.fieldKey, enabled: !field.enabled }) });
    if (response.ok) setFields((current) => current.map((entry) => entry.fieldKey === field.fieldKey ? { ...entry, enabled: !entry.enabled } : entry));
  }

  return <main className="py-10"><Container>
    <div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Users</p><h1 className="mt-2 font-serif text-4xl">Membership link approvals</h1><p className="mt-2 max-w-2xl text-sm text-ink/60">Review requests to connect authenticated users to existing member records. No member record is created by registration.</p></div>
    {message && <p className="mb-4 rounded-lg bg-sand px-4 py-3 text-sm font-semibold">{message}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section className="grid gap-4 lg:col-span-9">
        {requests.length === 0 && <Card><p className="text-sm text-ink/60">No pending membership link requests.</p></Card>}
        {requests.map((item) => <Card key={item.id} className="grid !gap-0 !p-4">
          <div><p className="font-semibold">{item.user.name}</p><p className="text-sm text-ink/60">{item.user.email} · {item.user.emailVerifiedAt ? "Email verified" : "Email not verified"}</p></div>
          <div className="mt-1 rounded-xl border border-ink/10 bg-sand/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Suggested member match</p>
            {item.suggestedMatch ? <><p className="mt-2 font-semibold">{item.suggestedMatch.firstName} {item.suggestedMatch.lastName}</p><p className="text-sm text-ink/60">{item.suggestedMatch.family.lastName} family · {item.suggestedMatch.email ?? "No email"} · Match score {item.suggestedMatch.matchScore}</p>{item.suggestedMatch.memberLink && <p className="mt-2 text-sm font-semibold text-coral">Already linked to {item.suggestedMatch.memberLink.user.name} ({item.suggestedMatch.memberLink.user.email})</p>}</> : <p className="mt-2 text-sm text-ink/60">No likely match found. Select a member record in the API before approving.</p>}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-end gap-2"><button type="button" className="focus-ring inline-flex !h-10 !w-fit min-w-[7rem] shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-coral px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={!item.suggestedMatch} onClick={() => void decide(item, "approve")}>Approve</button>{item.suggestedMatch?.memberLink && <button type="button" className="focus-ring inline-flex !h-10 !w-fit min-w-[10rem] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-coral px-4 text-sm font-semibold text-coral" onClick={() => void decide(item, "approve", true)}>Override and link</button>}<button type="button" className="focus-ring inline-flex !h-10 !w-fit min-w-[7rem] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-ink/15 px-4 text-sm font-semibold" onClick={() => void decide(item, "decline")}>Decline</button></div>
        </Card>)}
      </section>
      <aside className="lg:col-span-3"><Card><h2 className="font-serif text-2xl">Editable fields</h2><p className="mt-2 text-sm leading-6 text-ink/60">Enabled fields apply globally to all linked users. Family fields are available only to heads of household.</p><div className="mt-5 grid gap-3">{fields.map((field) => <label key={field.fieldKey} className="flex items-center justify-between gap-3 text-sm"><span>{field.label}</span><input type="checkbox" checked={field.enabled} onChange={() => void toggle(field)} className="h-4 w-4 accent-coral" /></label>)}</div></Card></aside>
    </div>
  </Container></main>;
}
