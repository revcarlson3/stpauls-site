"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button, Card, Container, Notification } from "@/components/ui";
import { announcementDocumentToHtml, defaultAnnouncementDocument, parseAnnouncementDocument, type AnnouncementDocument } from "@/lib/announcement-document";

const AnnouncementCanvasEditor = dynamic(() => import("@/components/announcement-canvas-editor").then((module) => module.AnnouncementCanvasEditor), { ssr: false });

type Publication = {
  id: string;
  title: string;
  bodyHtml: string;
  documentJson: AnnouncementDocument | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishAt: string | null;
  publishedAt: string | null;
  emailDelivery: { status: string; recipientCount: number; sentCount: number; failedCount: number; note: string | null } | null;
};
type Template = { id: string; name: string; title: string; bodyHtml: string; documentJson: AnnouncementDocument | null };
type FormState = { title: string; bodyHtml: string; documentJson: AnnouncementDocument; publishAt: string };
const blank: FormState = { title: "", bodyHtml: "", documentJson: defaultAnnouncementDocument(), publishAt: "" };

function dateInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export default function SiteAnnouncementsPage() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState<FormState>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/announcement-publications", { cache: "no-store" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error ?? "Unable to load announcements.");
    setPublications(value.publications ?? []);
    setTemplates(value.templates ?? []);
  }
  useEffect(() => { void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load announcements.")); }, []);

  function edit(publication: Publication) {
    setEditing(publication.id);
    const documentJson = parseAnnouncementDocument(publication.documentJson) ?? defaultAnnouncementDocument(publication.title);
    setForm({ title: publication.title, bodyHtml: publication.bodyHtml, documentJson, publishAt: dateInput(publication.publishAt) });
    setError("");
    setNotice("");
  }

  async function save() {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(editing ? `/api/announcement-publications/${editing}` : "/api/announcement-publications", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, bodyHtml: announcementDocumentToHtml(form.documentJson), documentJson: form.documentJson }) });
    const value = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(value.error ?? "Unable to save publication."); return; }
    setForm(blank); setEditing(null); setNotice(editing ? "Draft saved." : "Draft created."); await load();
  }

  async function action(id: string, actionName: string, status?: string) {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/announcement-publications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, status }) });
    const value = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(value.error ?? "Unable to update publication."); return; }
    setNotice(actionName === "duplicate" ? "Publication duplicated as a draft." : `Publication ${status?.toLowerCase()}.`); await load();
  }

  async function sendEmail(id: string) {
    if (!window.confirm("Send this publication to active members who opted in to email messages?")) return;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/announcement-publications/${id}/send`, { method: "POST" });
    const value = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(value.error ?? "Unable to send announcement email."); return; }
    setNotice(`Email sent to ${value.recipientCount} recipient${value.recipientCount === 1 ? "" : "s"}.`); await load();
  }

  async function saveTemplate() {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/announcement-publications/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: templateName, title: form.title, bodyHtml: announcementDocumentToHtml(form.documentJson), documentJson: form.documentJson }) });
    const value = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(value.error ?? "Unable to save template."); return; }
    setTemplateName(""); setNotice("Template saved."); await load();
  }

  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Public Website</p><h1 className="mt-2 font-serif text-4xl">Announcements</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">Design visual publications, reuse past work, publish an archive, and optionally email the latest publication to opted-in members.</p>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}{notice && <Notification variant="success" className="mt-6">{notice}</Notification>}<div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"><Card className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-2xl">{editing ? "Edit publication" : "New publication draft"}</h2><p className="mt-1 text-sm text-ink/55">Design the publication on a visual canvas. The site generates accessible HTML and email content from the saved document.</p></div>{editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm(blank); }}>New draft</Button>}</div><div className="mt-5 grid gap-4"><label className="grid gap-1 text-sm font-semibold">Title<input value={form.title} maxLength={200} onChange={(event) => { const title = event.target.value; setForm((current) => ({ ...current, title, documentJson: { ...current.documentJson, elements: current.documentJson.elements.map((element) => element.id === "title" && element.type === "text" ? { ...element, text: title } : element) } })); }} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Publish date (optional)<input type="datetime-local" value={form.publishAt} onChange={(event) => setForm({ ...form, publishAt: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/55">Publishing makes the publication available in the public archive immediately unless a future date is set.</span></label><div className="grid gap-1 text-sm font-semibold"><span>Visual publication</span><AnnouncementCanvasEditor value={form.documentJson} onChange={(documentJson) => setForm({ ...form, documentJson, bodyHtml: announcementDocumentToHtml(documentJson) })} /></div><div className="flex flex-wrap gap-3"><Button type="button" disabled={busy || !form.title.trim()} onClick={() => void save()}>{busy ? "Saving..." : "Save draft"}</Button>{editing && <Button type="button" variant="secondary" disabled={busy} onClick={() => void action(editing, "status", "PUBLISHED")}>Publish</Button>}</div><div className="grid gap-2 rounded-lg border border-ink/10 bg-mist/30 p-4"><h3 className="text-sm font-semibold">Reusable template</h3><div className="flex flex-wrap gap-2"><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" className="focus-ring min-w-48 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" /><Button type="button" variant="secondary" disabled={busy || !templateName.trim() || !form.title.trim()} onClick={() => void saveTemplate()}>Save current as template</Button></div>{templates.length > 0 && <label className="grid gap-1 text-xs font-semibold text-ink/55">Use template<select className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-normal text-ink" value="" onChange={(event) => { const template = templates.find((item) => item.id === event.target.value); if (template) { const documentJson = parseAnnouncementDocument(template.documentJson) ?? defaultAnnouncementDocument(template.title); setForm({ title: template.title, bodyHtml: announcementDocumentToHtml(documentJson), documentJson, publishAt: "" }); } }}><option value="">Choose a saved template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>}</div></div></Card><Card className="p-5 sm:p-7"><h2 className="font-serif text-2xl">Publications and archive</h2><div className="mt-5 grid gap-3">{publications.map((publication) => <article key={publication.id} className="rounded-xl border border-ink/10 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{publication.title}</h3><p className="mt-1 text-xs text-ink/55">{publication.status} {publication.publishedAt ? `· ${new Date(publication.publishedAt).toLocaleString()}` : ""}</p></div><span className="rounded-full bg-mist px-2 py-1 text-xs font-semibold text-ink/65">{publication.status}</span></div><div className="mt-3 line-clamp-3 text-sm text-ink/65" dangerouslySetInnerHTML={{ __html: publication.bodyHtml }} /><div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold"><button type="button" className="focus-ring text-coral hover:underline" onClick={() => edit(publication)}>Edit</button><button type="button" className="focus-ring text-coral hover:underline" disabled={busy} onClick={() => void action(publication.id, "duplicate")}>Duplicate</button>{publication.status === "DRAFT" && <button type="button" className="focus-ring text-coral hover:underline" disabled={busy} onClick={() => void action(publication.id, "status", "PUBLISHED")}>Publish</button>}{publication.status === "PUBLISHED" && <><button type="button" className="focus-ring text-coral hover:underline" disabled={busy} onClick={() => void sendEmail(publication.id)}>Send email</button><button type="button" className="focus-ring text-coral hover:underline" disabled={busy} onClick={() => void action(publication.id, "status", "ARCHIVED")}>Archive</button></>}{publication.status === "ARCHIVED" && <button type="button" className="focus-ring text-coral hover:underline" disabled={busy} onClick={() => void action(publication.id, "status", "DRAFT")}>Restore draft</button>}</div>{publication.emailDelivery && <p className="mt-3 text-xs text-ink/55">Email: {publication.emailDelivery.status.toLowerCase()} · {publication.emailDelivery.sentCount}/{publication.emailDelivery.recipientCount} delivered</p>}</article>)}{!publications.length && <p className="text-sm text-ink/60">No publications yet.</p>}</div><p className="mt-6 text-sm text-ink/55">The public archive is available at <code>/announcements</code> and can also be inserted into any page with the Announcements element.</p></Card></div></Container></main>;
}
