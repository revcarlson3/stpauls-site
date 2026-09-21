"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Container, Notification } from "@/components/ui";

type Ticket = { id: string; subject: string; description: string; status: string; updatedAt: string; createdBy: { name: string }; _count: { messages: number; attachments: number } };

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => { void fetch("/api/support/tickets").then(async (response) => { if (!response.ok) throw new Error("Support access is unavailable."); setTickets((await response.json()).tickets); }).catch((reason: Error) => setError(reason.message)); }, []);

  async function createTicket(event: FormEvent) {
    event.preventDefault();
    setError(""); setSent(false);
    const form = new FormData();
    form.set("subject", subject); form.set("description", description);
    Array.from(files ?? []).forEach((file) => form.append("attachments", file));
    const response = await fetch("/api/support/tickets", { method: "POST", body: form });
    if (!response.ok) { setError((await response.json()).error ?? "Unable to create ticket."); return; }
    setSubject(""); setDescription(""); setFiles(null); setSent(true);
    const refreshed = await fetch("/api/support/tickets");
    if (refreshed.ok) setTickets((await refreshed.json()).tickets);
  }

  return <main className="py-12 sm:py-16"><Container className="max-w-5xl">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Support</p>
    <h1 className="mt-2 font-serif text-4xl">How can we help?</h1>
    <p className="mt-3 max-w-2xl text-ink/60">Send a question to the support team. Your support conversations are visible only to you and platform support staff.</p>
    {error && <Notification variant="danger" className="mt-6">{error}</Notification>}
    {sent && <Notification variant="success" className="mt-6">Your support ticket was created.</Notification>}
    <Card className="mt-8 p-6"><h2 className="font-serif text-2xl">Create a support ticket</h2><form onSubmit={createTicket} className="mt-5 grid gap-4">
      <label className="text-sm font-semibold">Subject<input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} className="focus-ring mt-2 block w-full rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
      <label className="text-sm font-semibold">Description<textarea required maxLength={10000} value={description} onChange={(event) => setDescription(event.target.value)} className="focus-ring mt-2 block min-h-32 w-full rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
      <label className="text-sm font-semibold">Attachments <span className="font-normal text-ink/55">(PDF, text, CSV, PNG, JPG, or WebP; 10 MB each, 20 MB total)</span><input type="file" multiple accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={(event) => setFiles(event.target.files)} className="focus-ring mt-2 block w-full text-sm font-normal" /></label>
      <Button type="submit" className="w-fit">Submit ticket</Button>
    </form></Card>
    <section className="mt-10"><h2 className="font-serif text-2xl">Your support tickets</h2><div className="mt-4 grid gap-3">{tickets.map((ticket) => <Link key={ticket.id} href={`/account/support/${ticket.id}`} className="focus-ring rounded-xl border border-ink/10 bg-white p-5 hover:border-coral"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{ticket.subject}</h3><span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">{ticket.status.replace("_", " ")}</span></div><p className="mt-2 line-clamp-2 text-sm text-ink/60">{ticket.description}</p><p className="mt-3 text-xs text-ink/45">Updated {new Date(ticket.updatedAt).toLocaleString()} · {ticket._count.messages} replies</p></Link>)}</div></section>
  </Container></main>;
}
