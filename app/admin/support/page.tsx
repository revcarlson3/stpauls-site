"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, Card, Container, Notification } from "@/components/ui";

type Ticket = { id: string; subject: string; description: string; status: string; updatedAt: string; creator: { name: string }; _count: { messages: number; attachments: number } };
type Detail = Ticket & { churchId: string; attachments: { id: string; originalName: string; mimeType: string; sizeBytes: number }[]; messages: { id: string; body: string; createdAt: string; author: { name: string }; attachments: { id: string; originalName: string; mimeType: string; sizeBytes: number }[] }[] };

export default function SupportManagementPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState("");

  async function loadTickets() {
    const response = await fetch("/api/admin/support/tickets");
    if (!response.ok) throw new Error("Platform administrator access is required.");
    setTickets((await response.json()).tickets);
  }
  async function loadTicket(id: string) {
    const response = await fetch(`/api/admin/support/tickets/${id}`);
    if (!response.ok) throw new Error("Unable to load support ticket.");
    setSelected(await response.json());
  }
  useEffect(() => { void loadTickets().catch((reason: Error) => setError(reason.message)); }, []);

  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(); form.set("body", body);
    Array.from(files ?? []).forEach((file) => form.append("attachments", file));
    const response = await fetch(`/api/admin/support/tickets/${selected.id}`, { method: "POST", body: form });
    if (!response.ok) { setError((await response.json()).error ?? "Unable to send reply."); return; }
    setBody(""); setFiles(null); await Promise.all([loadTickets(), loadTicket(selected.id)]);
  }
  const attachment = (item: { id: string; originalName: string; mimeType: string; sizeBytes: number }) => <a key={item.id} className="block text-sm text-coral hover:underline" href={`/api/admin/support/attachments/${item.id}`}>{item.originalName} <span className="text-ink/45">({item.mimeType}, {Math.ceil(item.sizeBytes / 1024)} KB)</span></a>;

  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Global administration</p><h1 className="mt-2 font-serif text-4xl">Support management</h1><p className="mt-2 text-ink/60">Review tenant support tickets and reply securely. Attachments remain tenant-scoped and are served through authenticated downloads.</p>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}<div className="mt-8 grid gap-6 lg:grid-cols-[minmax(18rem,28rem)_1fr]"><Card className="p-4"><h2 className="font-serif text-2xl">Tenant tickets</h2><div className="mt-4 grid gap-2">{tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => void loadTicket(ticket.id).catch((reason: Error) => setError(reason.message))} className={`focus-ring rounded-lg border p-4 text-left ${selected?.id === ticket.id ? "border-coral bg-mist" : "border-ink/10 hover:border-coral"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{ticket.subject}</span><span className="text-xs">{ticket.status.replace("_", " ")}</span></div><p className="mt-1 text-xs text-ink/55">{ticket.creator.name} · {ticket._count.messages} replies · {new Date(ticket.updatedAt).toLocaleString()}</p></button>)}</div></Card>{selected ? <Card className="p-6"><p className="text-xs text-ink/50">Church {selected.churchId}</p><h2 className="mt-1 font-serif text-3xl">{selected.subject}</h2><p className="mt-4 whitespace-pre-wrap">{selected.description}</p><div className="mt-4 grid gap-1">{selected.attachments.map(attachment)}</div><div className="mt-6 grid gap-4">{selected.messages.map((message) => <div key={message.id} className="rounded-lg border border-ink/10 p-4"><p className="text-xs font-semibold text-ink/55">{message.author.name} · {new Date(message.createdAt).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap">{message.body}</p><div className="mt-3 grid gap-1">{message.attachments.map(attachment)}</div></div>)}</div><form onSubmit={reply} className="mt-6 grid gap-3 border-t border-ink/10 pt-6"><label className="text-sm font-semibold">Reply<textarea required maxLength={10000} value={body} onChange={(event) => setBody(event.target.value)} className="focus-ring mt-2 block min-h-28 w-full rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><input type="file" multiple accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={(event) => setFiles(event.target.files)} className="focus-ring block w-full text-sm" /><Button type="submit" className="w-fit">Send reply</Button></form></Card> : <Card className="p-6 text-ink/60">Select a ticket to view its tenant, messages, and attachment metadata.</Card>}</div></Container></main>;
}
