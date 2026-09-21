"use client";

import { useEffect, useState } from "react";
import { Button, Card, Container, Notification } from "@/components/ui";
import { GlobalAdminBackLink } from "@/app/global-admin/back-link";
import { RichTextField } from "@/app/admin/editor/editor-canvas";
import { GlobalAnnouncementMediaPicker } from "@/components/global-announcement-media-picker";

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: string;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  deliveryCount: number;
  acknowledgedCount: number;
  audience: string;
  placement: string;
  tenant: { id: string; name: string } | null;
};
type FormState = { title: string; body: string; severity: string; audience: string; placement: string; churchId: string; startsAt: string; endsAt: string; isActive: boolean };
const blankForm: FormState = { title: "", body: "", severity: "INFO", audience: "GLOBAL", placement: "AUTHENTICATED", churchId: "", startsAt: "", endsAt: "", isActive: true };

function inputDate(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export default function GlobalAdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState<FormState>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [churches, setChurches] = useState<{ id: string; name: string; status: string }[]>([]);

  async function load() {
    const response = await fetch("/api/global-admin/announcements", { cache: "no-store" });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error ?? "Unable to load announcements.");
    setAnnouncements(value.announcements ?? []);
  }
  useEffect(() => { void Promise.all([load(), fetch("/api/global-admin/churches").then((response) => response.json()).then((value) => setChurches(Array.isArray(value) ? value.filter((church) => church.status === "ACTIVE") : []))]).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load announcements.")); }, []);

  function edit(announcement: Announcement) {
    setEditingId(announcement.id);
    setForm({ title: announcement.title, body: announcement.body, severity: announcement.severity, audience: announcement.audience, placement: announcement.placement, churchId: announcement.tenant?.id ?? "", startsAt: inputDate(announcement.startsAt), endsAt: inputDate(announcement.endsAt), isActive: announcement.isActive });
    setMessage("");
    setError("");
  }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(editingId ? `/api/global-admin/announcements/${editingId}` : "/api/global-admin/announcements", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const value = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.status === 428) { window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/announcements")}&reauth=1`; return; }
    if (!response.ok) { setError(value.error ?? "Unable to save announcement."); return; }
    setForm(blankForm); setEditingId(null); setMessage(editingId ? "Announcement updated." : "Announcement published."); await load();
  }

  async function remove(announcement: Announcement) {
    if (!window.confirm(`Delete “${announcement.title}”?`)) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/global-admin/announcements/${announcement.id}`, { method: "DELETE" });
    const value = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.status === 428) { window.location.href = `/global-admin/login?callbackUrl=${encodeURIComponent("/global-admin/announcements")}&reauth=1`; return; }
    if (!response.ok) { setError(value.error ?? "Unable to delete announcement."); return; }
    if (editingId === announcement.id) { setEditingId(null); setForm(blankForm); }
    setMessage("Announcement deleted."); await load();
  }

  return <main className="min-h-screen bg-sand py-10 sm:py-14"><Container><div className="flex justify-end"><GlobalAdminBackLink /></div><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Platform communications</p><h1 className="mt-2 font-serif text-4xl">Global announcements</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">Publish notices for all sites, one tenant, or public pages.</p>{error && <Notification variant="danger" className="mt-6">{error}</Notification>}{message && <Notification variant="success" className="mt-6">{message}</Notification>}<div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"><Card className="p-5 sm:p-7"><h2 className="font-serif text-2xl">{editingId ? "Edit announcement" : "Create announcement"}</h2><div className="mt-5 grid gap-4"><label className="grid gap-1 text-sm font-semibold">Title<input value={form.title} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /></label><div className="grid gap-1 text-sm font-semibold"><span>Message</span><RichTextField value={form.body} onChange={(body) => setForm({ ...form, body })} toolbarExtras={(insertHtml) => <GlobalAnnouncementMediaPicker onInsert={(url) => insertHtml(`<img src="${url}" alt="" />`)} />} /></div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Audience  <select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value, churchId: "", placement: event.target.value === "TENANT" ? "AUTHENTICATED" : form.placement })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="GLOBAL">All sites</option><option value="TENANT">One tenant</option></select></label>{form.audience === "TENANT" ? <label className="grid gap-1 text-sm font-semibold">Tenant<select required value={form.churchId} onChange={(event) => setForm({ ...form, churchId: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">Select tenant</option>{churches.map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}</select></label> : <label className="grid gap-1 text-sm font-semibold">Placement<select value={form.placement} onChange={(event) => setForm({ ...form, placement: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="AUTHENTICATED">Logged-in users</option><option value="PUBLIC_TICKER">Public ticker</option>  <option value="BOTH">Logged-in and public</option><option value="ADMIN_DASHBOARD">Admin Dashboard</option></select></label>}<label className="grid gap-1 text-sm font-semibold">Severity<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option>INFO</option><option>SUCCESS</option><option>WARNING</option><option>CRITICAL</option></select></label><label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label></div><label className="grid gap-1 text-sm font-semibold">Starts at<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/55">Leave blank to start immediately.</span></label><label className="grid gap-1 text-sm font-semibold">Ends at<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /><span className="text-xs font-normal text-ink/55">Leave blank for no expiration.</span></label><div className="flex flex-wrap gap-3"><Button type="button" disabled={busy || !form.title.trim() || !form.body.trim()} onClick={() => void save()}>{busy ? "Saving..." : editingId ? "Save changes" : "Publish announcement"}</Button>{editingId && <Button type="button" disabled={busy} variant="secondary" onClick={() => { setEditingId(null); setForm(blankForm); }}>Cancel</Button>}</div></div></Card><Card className="p-5 sm:p-7"><h2 className="font-serif text-2xl">Published announcements</h2><div className="mt-5 grid gap-3">{announcements.map((announcement) => <article key={announcement.id} className="rounded-xl border border-ink/10 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{announcement.title}</h3><p className="mt-1 text-xs text-ink/55">{announcement.severity} · starts {new Date(announcement.startsAt).toLocaleString()} {announcement.endsAt ? `· ends ${new Date(announcement.endsAt).toLocaleString()}` : "· no end date"}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${announcement.isActive ? "bg-mist text-ink/70" : "border border-ink/15 text-ink/50"}`}>{announcement.isActive ? "Active" : "Inactive"}</span></div><p className="mt-3 whitespace-pre-wrap text-sm text-ink/70">{announcement.body}</p><p className="mt-3 text-xs text-ink/55">{announcement.deliveryCount} site{announcement.deliveryCount === 1 ? "" : "s"} delivered · {announcement.acknowledgedCount} acknowledged</p><div className="mt-4 flex gap-3"><button type="button" onClick={() => edit(announcement)} className="focus-ring text-sm font-semibold text-coral hover:underline">Edit</button><button type="button" disabled={busy} onClick={() => void remove(announcement)} className="focus-ring text-sm font-semibold text-coral hover:underline disabled:opacity-50">Delete</button></div></article>)}{!announcements.length && <p className="text-sm text-ink/60">No announcements have been published.</p>}</div></Card></div></Container></main>;
}
