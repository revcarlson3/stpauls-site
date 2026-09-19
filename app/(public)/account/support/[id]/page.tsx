"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Container, Notification } from "@/components/ui";

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<any>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const load = useCallback(async () => { const response = await fetch(`/api/support/tickets/${id}`); if (!response.ok) throw new Error("Support ticket not found."); setTicket(await response.json()); }, [id]);
  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, [load]);
  async function reply(event: FormEvent) {
    event.preventDefault(); const form = new FormData(); form.set("body", body); Array.from(files ?? []).forEach((file) => form.append("attachments", file));
    const response = await fetch(`/api/support/tickets/${id}`, { method: "POST", body: form });
    if (!response.ok) { setError((await response.json()).error ?? "Unable to send reply."); return; }
    setBody(""); setFiles(null); await load();
  }
  if (error && !ticket) return <main className="py-16"><Container><Notification variant="danger">{error}</Notification><Link className="mt-4 inline-block text-coral hover:underline" href="/account/support">Back to support</Link></Container></main>;
  if (!ticket) return <main className="py-16"><Container>Loading…</Container></main>;
  return <main className="py-12 sm:py-16"><Container className="max-w-3xl"><Link href="/account/support" className="text-sm font-semibold text-coral hover:underline">← Support tickets</Link><h1 className="mt-4 font-serif text-4xl">{ticket.subject}</h1><p className="mt-2 text-sm text-ink/55">{ticket.status.replace("_", " ")}</p><Card className="mt-8 p-6"><p className="whitespace-pre-wrap">{ticket.description}</p>{ticket.attachments.map((attachment: any) => <a key={attachment.id} className="mt-4 block text-sm text-coral hover:underline" href={`/api/support/attachments/${attachment.id}`}>{attachment.originalName}</a>)}</Card><div className="mt-6 grid gap-4">{ticket.messages.map((message: any) => <Card key={message.id} className="p-5"><p className="text-xs font-semibold text-ink/55">{message.author.name} · {new Date(message.createdAt).toLocaleString()}</p><p className="mt-3 whitespace-pre-wrap">{message.body}</p>{message.attachments.map((attachment: any) => <a key={attachment.id} className="mt-3 block text-sm text-coral hover:underline" href={`/api/support/attachments/${attachment.id}`}>{attachment.originalName}</a>)}</Card>)}</div>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}<Card className="mt-6 p-6"><form onSubmit={reply} className="grid gap-4"><label className="text-sm font-semibold">Reply<textarea required maxLength={10000} value={body} onChange={(event) => setBody(event.target.value)} className="focus-ring mt-2 block min-h-28 w-full rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><input type="file" multiple accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={(event) => setFiles(event.target.files)} className="focus-ring block w-full text-sm" /><Button type="submit" className="w-fit">Send reply</Button></form></Card></Container></main>;
}
