"use client";

import { useEffect, useState } from "react";
import { Button, Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";

type Ticket = {
  id: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
  originatingTenant?: { id: string; name: string; slug?: string } | null;
  messages?: Array<{ id: string; body: string; isInternal: boolean; createdAt: string; author: { id: string; name: string; email: string }; attachments?: Array<{ id: string; originalName: string }> }>;
};
const statuses = ["OPEN", "IN_PROGRESS", "WAITING_ON_TENANT", "RESOLVED", "CLOSED"];
const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];

export default function GlobalAdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/global-admin/support", { cache: "no-store" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error ?? "Unable to load support tickets.");
    setTickets(value.tickets ?? []);
  }
  async function openTicket(id: string) {
    const response = await fetch(`/api/global-admin/support/${id}`, { cache: "no-store" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error ?? "Unable to load support ticket.");
    setSelected(value.ticket);
    setNote("");
    setReply("");
    setReplyFiles([]);
  }
  async function submitReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true); setError(""); setMessage("");
    const form = new FormData();
    form.set("body", reply);
    replyFiles.forEach((file) => form.append("attachments", file));
    const response = await fetch(`/api/global-admin/support/${selected.id}`, { method: "POST", body: form });
    const value = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.status === 428) { window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/support")}&reauth=1`; return; }
    if (!response.ok) { setError(value.error ?? "Unable to add support reply."); return; }
    setReply(""); setReplyFiles([]);
    await openTicket(selected.id);
    await load();
    setMessage("Public reply sent to the tenant.");
  }
  useEffect(() => {
    void Promise.all([load(), fetch("/api/global-admin/support/assignees", { cache: "no-store" }).then(async (response) => {
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error ?? "Unable to load support assignees.");
      setAssignees(value.assignees ?? []);
    })]).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load support tickets."));
  }, []);

  async function update(fields: Record<string, string | null>) {
    if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/global-admin/support/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    const value = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.status === 428) { window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/support")}&reauth=1`; return; }
    if (!response.ok) { setError(value.error ?? "Unable to update support ticket."); return; }
    setSelected(value.ticket);
    setNote("");
    setMessage("Support ticket updated.");
    await load();
  }

  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container><div className="flex justify-end"><GlobalAdminBackLink /></div><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Selected site</p><h1 className="mt-2 font-serif text-4xl">Support management</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Review and manage support activity for the selected site. Internal notes are visible only to platform administrators.</p>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}{message && <Notification variant="success" className="mt-6">{message}</Notification>}<div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"><Card className="p-5"><h2 className="font-serif text-2xl">Tickets</h2><div className="mt-4 grid gap-2">{tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => void openTicket(ticket.id).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load support ticket."))} className={`focus-ring rounded-lg border px-4 py-3 text-left ${selected?.id === ticket.id ? "border-coral bg-coral/5" : "border-ink/10 bg-white"}`}><p className="text-sm font-semibold">{ticket.subject}</p><p className="mt-1 text-xs text-ink/55">{ticket.originatingTenant?.name ?? "Selected site"} · {ticket.createdBy?.name ?? "site user"} · {ticket.status} · {ticket.priority}</p></button>)}{!tickets.length && <p className="text-sm text-ink/60">No support tickets for this site.</p>}</div></Card>{selected ? <Card className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-serif text-2xl">{selected.subject}</h2><p className="mt-1 text-xs text-ink/55">Originating tenant: {selected.originatingTenant?.name ?? "Selected site"} · Originating user: {selected.createdBy?.name ?? "site user"} ({selected.createdBy?.email ?? "email unavailable"}) · {new Date(selected.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">{selected.priority}</span></div><p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-ink/75">{selected.description}</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-semibold">Status<select value={selected.status} disabled={busy} onChange={(event) => void update({ status: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold">Priority<select value={selected.priority} disabled={busy} onChange={(event) => void update({ priority: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm">{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold">Assignment<select value={selected.assignedTo?.id ?? ""} disabled={busy} onChange={(event) => void update({ assignedToId: event.target.value || null })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"><option value="">Unassigned</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}</select></label></div>  <div className="mt-7 grid gap-6"><div><label className="grid gap-2 text-sm font-semibold">Public reply<textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} maxLength={10000} className="focus-ring rounded-lg border border-coral/40 bg-white px-3 py-2 font-normal" placeholder="Reply to the tenant..." /></label><input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.csv" onChange={(event) => setReplyFiles(Array.from(event.target.files ?? []))} className="mt-3 block text-xs" /><Button type="button" className="mt-3" disabled={busy || !reply.trim()} onClick={() => void submitReply()}>Send public reply</Button></div><div><label className="grid gap-2 text-sm font-semibold">Private internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={10000} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" placeholder="Add a private support note..." /></label><Button type="button" className="mt-3" disabled={busy || !note.trim()} onClick={() => void update({ internalNote: note })}>Add internal note</Button></div></div>{selected.messages?.length ? <div className="mt-8 grid gap-3"><h3 className="font-semibold">Conversation</h3>{selected.messages.map((item) => <div key={item.id} className={`rounded-lg border px-4 py-3 ${item.isInternal ? "border-ink/10 bg-mist/40" : "border-coral/25 bg-coral/5"}`}><p className="text-xs font-semibold uppercase tracking-wide">{item.isInternal ? "Private internal note" : "Public reply"}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p>{item.attachments?.length ? <div className="mt-2 grid gap-1">{item.attachments.map((attachment) => <a key={attachment.id} href={`/api/global-admin/support/attachments/${attachment.id}`} className="text-xs text-coral underline">{attachment.originalName}</a>)}</div> : null}<p className="mt-2 text-xs text-ink/50">{item.author.name} · {new Date(item.createdAt).toLocaleString()}</p></div>)}</div> : null}</Card> : <Card className="p-7 text-sm text-ink/60">Select a ticket to view details.</Card>}</div></Container></main>;
}
