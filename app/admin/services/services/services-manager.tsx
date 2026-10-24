"use client";

import { useEffect, useMemo, useState } from "react";
import { BIBLE_BOOKS, LSB_LITURGIES } from "@/lib/worship-service";

type Clergy = { id: string; title: string; firstName: string | null; lastName: string | null };
type Hymn = { number: string; title: string; sourceUrl?: string };
type Lesson = { book: string; startChapter: string; startVerse: string; endChapter: string; endVerse: string };
type Service = {
  id: string; title: string; description: string | null; liturgy: string | null; status: string; scheduledAt: string | null; startsAt: string; endsAt: string | null;
  livestreamEnabled: boolean; videoUrl: string | null; bulletinUrl: string | null; featuredImageUrl: string | null;
  clergy: { clergy: Clergy }[]; hymns: Hymn[]; lessons: { reference: string | null }[]; calendarEvent: { eventType: string; category: string | null; location: string | null } | null;
};
type ServiceForm = { title: string; description: string; liturgy: string; startsAt: string; endsAt: string; scheduledAt: string; status: string; livestreamEnabled: boolean; videoUrl: string; addToCalendar: boolean; eventType: string; category: string; location: string };

const inputClass = "focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal";
const emptyLesson = (): Lesson => ({ book: "John", startChapter: "3", startVerse: "16", endChapter: "", endVerse: "" });
const emptyHymn = (): Hymn => ({ number: "", title: "" });

function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function serviceDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ServicesManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [clergy, setClergy] = useState<Clergy[]>([]);
  const [eventSettings, setEventSettings] = useState({ eventTypes: ["Worship"], categories: [] as string[], locations: [] as string[], timeZone: "America/Chicago" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hymnQuery, setHymnQuery] = useState("");
  const [hymnResults, setHymnResults] = useState<Hymn[]>([]);
  const [form, setForm] = useState<ServiceForm>(() => ({ title: "", description: "", liturgy: LSB_LITURGIES[0], startsAt: localDateTime(new Date()), endsAt: "", scheduledAt: "", status: "DRAFT", livestreamEnabled: false, videoUrl: "", addToCalendar: true, eventType: "Worship", category: "", location: "" }));
  const [selectedClergy, setSelectedClergy] = useState<string[]>([]);
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  async function load() {
    setLoading(true);
    const [serviceResponse, clergyResponse, settingsResponse] = await Promise.all([fetch("/api/services/services"), fetch("/api/services/clergy"), fetch("/api/events/settings")]);
    const serviceBody = await serviceResponse.json().catch(() => ({}));
    const clergyBody = await clergyResponse.json().catch(() => ({}));
    const settingsBody = await settingsResponse.json().catch(() => ({}));
    if (!serviceResponse.ok) setMessage(serviceBody.error ?? "Unable to load services.");
    setServices(serviceBody.services ?? []);
    setClergy((clergyBody.profiles ?? []).filter((profile: { status: string }) => profile.status === "ACTIVE"));
    if (settingsBody.settings) {
      const settings = settingsBody.settings;
      setEventSettings({ eventTypes: settings.eventTypes?.length ? settings.eventTypes : ["Worship"], categories: settings.categories ?? [], locations: settings.locations ?? [], timeZone: settings.timeZone ?? "America/Chicago" });
      setForm((current) => ({ ...current, eventType: settings.eventTypes?.includes(current.eventType) ? current.eventType : settings.eventTypes?.[0] ?? "Worship" }));
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function searchHymns() {
    if (hymnQuery.trim().length < 2) return;
    const response = await fetch(`/api/services/hymns/search?q=${encodeURIComponent(hymnQuery)}`);
    const body = await response.json().catch(() => ({}));
    setHymnResults(body.results ?? []);
    if (!response.ok) setMessage(body.error ?? "Unable to search Hymnary.org.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    data.set("payload", JSON.stringify({ ...form, clergyIds: selectedClergy, hymns, lessons }));
    const response = await fetch("/api/services/services", { method: "POST", body: data });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "Unable to save worship service.");
      setSaving(false);
      return;
    }
    event.currentTarget.reset();
    setSelectedClergy([]);
    setHymns([]);
    setLessons([]);
    setForm((current) => ({ ...current, title: "", description: "", startsAt: localDateTime(new Date()), endsAt: "", scheduledAt: "", videoUrl: "" }));
    setServices((current) => [body.service, ...current]);
    setMessage("Worship service added.");
    setSaving(false);
  }

  const clergyNames = useMemo(() => new Map(clergy.map((person) => [person.id, `${person.title} ${person.firstName ?? ""} ${person.lastName ?? ""}`.trim()])), [clergy]);

  return <div className="mt-8 grid gap-8">
    <section className="rounded-[var(--site-radius-card)] border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Add worship service</h2>
      <form onSubmit={submit} encType="multipart/form-data" className="mt-5 grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold md:col-span-2">Service name<input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} className={inputClass} placeholder="Sunday Divine Service" /></label>
          <label className="grid gap-1 text-sm font-semibold">Starts<input required type="datetime-local" value={form.startsAt} onChange={(event) => updateForm("startsAt", event.target.value)} className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold">Ends<input type="datetime-local" value={form.endsAt} onChange={(event) => updateForm("endsAt", event.target.value)} className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold">Visible after<input type="datetime-local" value={form.scheduledAt} onChange={(event) => updateForm("scheduledAt", event.target.value)} className={inputClass} /><span className="font-normal text-ink/55">Leave blank to make it available immediately.</span></label>
          <label className="grid gap-1 text-sm font-semibold">Status<select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className={inputClass}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="CANCELLED">Cancelled</option></select></label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">Description<textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} className={inputClass} rows={3} /></label>
        <label className="grid gap-1 text-sm font-semibold">Liturgy<select value={form.liturgy} onChange={(event) => updateForm("liturgy", event.target.value)} className={inputClass}><option value="">Not specified</option>{LSB_LITURGIES.map((liturgy) => <option key={liturgy}>{liturgy}</option>)}</select></label>

        <fieldset className="grid gap-3 rounded-xl border border-ink/10 p-4"><legend className="px-1 text-sm font-semibold">Assigned preacher or clergy</legend>{clergy.length ? <div className="grid gap-2 sm:grid-cols-2">{clergy.map((person) => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedClergy.includes(person.id)} onChange={(event) => setSelectedClergy((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))} />{clergyNames.get(person.id)}</label>)}</div> : <p className="text-sm text-ink/55">Add active profiles on the Preachers and Clergy page first.</p>}</fieldset>

        <fieldset className="grid gap-3 rounded-xl border border-ink/10 p-4"><legend className="px-1 text-sm font-semibold">Hymns</legend>{hymns.map((hymn, index) => <div key={index} className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]"><input className={inputClass} placeholder="Number" value={hymn.number} onChange={(event) => setHymns((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, number: event.target.value } : item))} /><input required className={inputClass} placeholder="Hymn title" value={hymn.title} onChange={(event) => setHymns((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /><button type="button" className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm" onClick={() => setHymns((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}<div className="flex flex-wrap gap-2"><button type="button" className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm" onClick={() => setHymns((current) => [...current, emptyHymn()])}>Add hymn</button><input className={inputClass} value={hymnQuery} onChange={(event) => setHymnQuery(event.target.value)} placeholder="Search number or title" /><button type="button" className="focus-ring rounded-full bg-mist px-3 py-2 text-sm font-semibold" onClick={() => void searchHymns()}>Search Hymnary</button></div>{hymnResults.length > 0 && <div className="grid gap-1 rounded-lg bg-mist p-3 text-sm">{hymnResults.map((hymn, index) => <button type="button" key={`${hymn.title}-${index}`} className="text-left hover:underline" onClick={() => { setHymns((current) => [...current, hymn]); setHymnResults([]); }}>{hymn.number ? `${hymn.number} — ` : ""}{hymn.title}</button>)}</div>}</fieldset>

        <fieldset className="grid gap-3 rounded-xl border border-ink/10 p-4"><legend className="px-1 text-sm font-semibold">Scripture lessons</legend>{lessons.map((lesson, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1.3fr_repeat(4,5rem)_auto]"><select className={inputClass} value={lesson.book} onChange={(event) => setLessons((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, book: event.target.value } : item))}>{BIBLE_BOOKS.map((book) => <option key={book}>{book}</option>)}</select>{(["startChapter", "startVerse", "endChapter", "endVerse"] as const).map((key) => <input key={key} className={inputClass} type="number" min="1" placeholder={key === "startChapter" ? "Ch." : key === "startVerse" ? "Verse" : key === "endChapter" ? "End ch." : "End v."} value={lesson[key]} onChange={(event) => setLessons((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: event.target.value } : item))} />)}<button type="button" className="focus-ring rounded-full border border-ink/20 px-3 py-2 text-sm" onClick={() => setLessons((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}<button type="button" className="focus-ring w-fit rounded-full border border-ink/20 px-3 py-2 text-sm" onClick={() => setLessons((current) => [...current, emptyLesson()])}>Add lesson</button></fieldset>

        <fieldset className="grid gap-4 rounded-xl border border-ink/10 p-4"><legend className="px-1 text-sm font-semibold">Calendar and media</legend><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.addToCalendar} onChange={(event) => updateForm("addToCalendar", event.target.checked)} />Create an event on the shared Events calendar</label>{form.addToCalendar && <div className="grid gap-4 md:grid-cols-3"><label className="grid gap-1 text-sm font-semibold">Event Type<select value={form.eventType} onChange={(event) => updateForm("eventType", event.target.value)} className={inputClass}>{eventSettings.eventTypes.map((value) => <option key={value}>{value}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Category<select value={form.category} onChange={(event) => updateForm("category", event.target.value)} className={inputClass}><option value="">None</option>{eventSettings.categories.map((value) => <option key={value}>{value}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Location<select value={form.location} onChange={(event) => updateForm("location", event.target.value)} className={inputClass}><option value="">None</option>{eventSettings.locations.map((value) => <option key={value}>{value}</option>)}</select></label></div>}<div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Bulletin (PDF)<input type="file" name="bulletin" accept="application/pdf" className={inputClass} /></label><label className="grid gap-1 text-sm font-semibold">Featured image<input type="file" name="featuredImage" accept="image/jpeg,image/png,image/webp" className={inputClass} /></label></div><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.livestreamEnabled} onChange={(event) => updateForm("livestreamEnabled", event.target.checked)} />Enable livestreaming for this service</label><label className="grid gap-1 text-sm font-semibold">Video link<input type="url" value={form.videoUrl} onChange={(event) => updateForm("videoUrl", event.target.value)} className={inputClass} placeholder="https://youtube.com/..." /></label></fieldset>
        <button disabled={saving} className="focus-ring w-fit rounded-full bg-coral px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Adding..." : "Add worship service"}</button>
      </form>
      {message && <p className="mt-4 text-sm font-semibold text-coral">{message}</p>}
    </section>
    <section className="grid gap-4"><h2 className="font-serif text-2xl">Worship services</h2>{loading ? <p className="text-sm text-ink/55">Loading services...</p> : services.length === 0 ? <p className="rounded-xl border border-dashed border-ink/20 p-6 text-sm text-ink/55">No worship services have been added.</p> : services.map((service) => <article key={service.id} className="rounded-xl border border-ink/10 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-serif text-xl">{service.title}</h3><p className="mt-1 text-sm text-ink/60">{serviceDate(service.startsAt)} · {service.status.toLowerCase()}{service.calendarEvent ? " · on calendar" : ""}</p></div>{service.featuredImageUrl && <img src={service.featuredImageUrl} alt="" className="h-16 w-28 rounded object-cover" />}</div>{service.liturgy && <p className="mt-3 text-sm">{service.liturgy}</p>}<p className="mt-2 text-sm text-ink/60">{service.clergy.map((entry) => `${entry.clergy.title} ${entry.clergy.firstName ?? ""} ${entry.clergy.lastName ?? ""}`.trim()).join(", ") || "No clergy assigned"}{service.lessons.length ? ` · ${service.lessons.map((lesson) => lesson.reference).join("; ")}` : ""}</p>{service.bulletinUrl && <a className="mt-3 inline-block text-sm font-semibold text-coral hover:underline" href={service.bulletinUrl} target="_blank" rel="noreferrer">View bulletin</a>}</article>)}</section>
  </div>;
}
