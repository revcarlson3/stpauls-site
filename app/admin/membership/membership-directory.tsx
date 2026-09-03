"use client";

import { type FormEvent, useEffect, useState } from "react";
import Image from "next/image";

type Member = {
  id: string; firstName: string; middleName: string | null; lastName: string | null; birthday: string;
  ageCategoryOverride: string | null; cellphone: string | null; otherPhone: string | null; otherPhoneType: string | null;
  email: string | null; memberNumber: number; gradeLevel: string | null; maritalStatus: string; weddingDate: string | null;
  deceasedDate: string | null; gender: string; status: string; familyRole: { name: string };
  memberType: { name: string }; family: Record<string, string | boolean | null>;
};
type Row = { id: string; firstName: string; middleName: string | null; lastName: string | null; familyLastName: string; memberNumber: number; memberType: string; status: string };
type Note = { id: string; individualId: string; reason: string; body: string; createdAt: string; updatedAt: string; author: { id: string; name: string } };

export function MembershipDirectory() {
  const [members, setMembers] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [types, setTypes] = useState<{ slug: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [memberType, setMemberType] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [noteReason, setNoteReason] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const photoUrl = selected && typeof selected.family.photographUrl === "string" && selected.family.photographUrl ? selected.family.photographUrl : "/no-family-photo.jpg";
  const selectedId = selected?.id;

  useEffect(() => {
    const params = new URLSearchParams({ ...(search ? { search } : {}), ...(memberType ? { memberType } : {}) });
    void fetch(`/api/membership?${params}`).then((response) => response.ok ? response.json() : null).then((value) => {
      if (value) { setMembers(value.members); setTypes(value.types); setSelected(value.selected); }
    }).catch(() => undefined);
  }, [search, memberType]);

  useEffect(() => {
    if (!selectedId) {
      setNotes([]);
      setNotesLoading(false);
      return;
    }
    setNotes([]);
    setNotesLoading(true);
    setNotesError("");
    void fetch(`/api/membership/notes?individualId=${encodeURIComponent(selectedId)}`).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load notes.");
      setNotes(value.notes);
    }).catch((reason: Error) => setNotesError(reason.message)).finally(() => setNotesLoading(false));
  }, [selectedId]);

  async function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setNoteSubmitting(true);
    setNotesError("");
    try {
      const response = await fetch("/api/membership/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ individualId: selected.id, reason: noteReason, body: noteBody })
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to save note.");
      setNotes((current) => [value.note, ...current]);
      setNoteReason("");
      setNoteBody("");
    } catch (reason) {
      setNotesError(reason instanceof Error ? reason.message : "Unable to save note.");
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function handleNoteDelete(note: Note) {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    setNotesError("");
    try {
      const response = await fetch(`/api/membership/notes/${note.id}`, { method: "DELETE" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to delete note.");
      setNotes((current) => current.filter((entry) => entry.id !== note.id));
    } catch (reason) {
      setNotesError(reason instanceof Error ? reason.message : "Unable to delete note.");
    }
  }

  return <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
    <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <h2 className="font-serif text-2xl">Members</h2>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Search by name<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="First or last name" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Member type<select value={memberType} onChange={(event) => setMemberType(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">All types</option>{types.map((type) => <option key={type.slug} value={type.slug}>{type.name}</option>)}</select></label>
      </div>
      <div className="mt-5 grid gap-1" aria-live="polite">{members.map((member) => <button type="button" key={member.id} onClick={() => void fetch(`/api/membership?id=${member.id}`).then((response) => response.json()).then((value) => setSelected(value.selected))} className={`focus-ring rounded-lg p-3 text-left hover:bg-mist ${selected?.id === member.id ? "bg-mist" : ""}`}><span className="block font-semibold">{member.firstName} {member.middleName ?? ""} {member.lastName ?? member.familyLastName}</span><span className="text-xs text-ink/55">#{member.memberNumber} · {member.memberType} · {member.status.toLowerCase()}</span></button>)}</div>
      {!members.length && <p className="mt-5 text-sm text-ink/60">No members match these filters.</p>}
    </section>
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Member details</h2>
      {selected ? <div className="mt-5 grid gap-6">
        <div className="flex flex-wrap justify-end gap-2"><a className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral" href={`/admin/membership/individuals/${selected.id}/edit`}>Edit individual</a><a className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral" href={`/admin/membership/families/${selected.family.id}/edit`}>Edit family</a></div>
        <div><p className="text-sm font-semibold uppercase tracking-wider text-coral">Individual</p><h3 className="mt-1 font-serif text-3xl">{selected.firstName} {selected.middleName} {selected.lastName ?? selected.family.lastName}</h3><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{[["Member number", selected.memberNumber], ["Member type", selected.memberType.name], ["Family role", selected.familyRole.name], ["Status", selected.status], ["Birthday", new Date(selected.birthday).toLocaleDateString()], ["Age category", selected.ageCategoryOverride ?? "Calculated"], ["Gender", selected.gender], ["Marital status", selected.maritalStatus], ["Grade level", selected.gradeLevel], ["Cellphone", selected.cellphone], ["Other phone", `${selected.otherPhone ?? ""} ${selected.otherPhoneType ? `(${selected.otherPhoneType})` : ""}`], ["Email", selected.email], ["Wedding date", selected.weddingDate ? new Date(selected.weddingDate).toLocaleDateString() : "—"], ["Deceased date", selected.deceasedDate ? new Date(selected.deceasedDate).toLocaleDateString() : "—"]].map(([label, value]) => <div key={String(label)}><dt className="font-semibold text-ink/60">{label}</dt><dd>{value || "—"}</dd></div>)}</dl></div>
        <div className="border-t border-ink/10 pt-5"><p className="text-sm font-semibold uppercase tracking-wider text-coral">Family</p><div className="mt-3 grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]"><button type="button" className="focus-ring block aspect-[4/5] overflow-hidden rounded-xl bg-mist" onClick={() => setLightboxOpen(true)} aria-label="Open family photograph"><Image src={photoUrl} alt={`Photograph of the ${selected.family.lastName} family`} width={320} height={400} className="h-full w-full object-cover" /></button><div><h3 className="font-serif text-2xl">{selected.family.familyNameOverride || selected.family.lastName}</h3><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{[["Formal greeting", selected.family.formalGreeting], ["Informal greeting", selected.family.informalGreeting], ["Address", [selected.family.addressStreet, selected.family.addressCity, selected.family.addressState, selected.family.addressZip].filter(Boolean).join(", ")], ["Secondary address", [selected.family.secondaryStreet, selected.family.secondaryCity, selected.family.secondaryState, selected.family.secondaryZip].filter(Boolean).join(", ")], ["Phone", selected.family.phone], ["Phone type", selected.family.phoneIsMobile ? "Cellphone" : "Land line"], ["Email", selected.family.email], ["Status", selected.family.status]].map(([label, value]) => <div key={String(label)}><dt className="font-semibold text-ink/60">{label}</dt><dd>{value || "—"}</dd></div>)}</dl></div></div></div>
        <section className="border-t border-ink/10 pt-5" aria-labelledby="membership-notes-heading"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><p className="text-sm font-semibold uppercase tracking-wider text-coral">Private record</p><h3 id="membership-notes-heading" className="mt-1 font-serif text-2xl">Notes</h3></div><p className="text-xs text-ink/55">Visible to membership managers</p></div><form onSubmit={handleNoteSubmit} className="mt-4 grid gap-3 rounded-xl bg-mist/60 p-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"><label className="grid gap-1 text-sm font-semibold" htmlFor="note-reason">Reason<input id="note-reason" value={noteReason} onChange={(event) => setNoteReason(event.target.value)} maxLength={120} required placeholder="Pastoral care, follow-up..." className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold" htmlFor="note-body">Note<textarea id="note-body" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} maxLength={5000} required rows={3} placeholder="Add a private note about this member..." className="focus-ring resize-y rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /></label></div><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-ink/55">Keep notes factual and relevant to member care.</span><button type="submit" disabled={noteSubmitting} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d95f43] disabled:cursor-not-allowed disabled:opacity-60">{noteSubmitting ? "Saving..." : "Add note"}</button></div></form>{notesError && <p role="alert" className="mt-3 text-sm text-coral">{notesError}</p>}{notesLoading ? <p className="mt-4 text-sm text-ink/60">Loading notes...</p> : notes.length ? <div className="mt-4 grid gap-3">{notes.map((note) => <article key={note.id} className="rounded-xl border border-ink/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{note.reason}</p><p className="mt-1 text-xs text-ink/55">{note.author.name} · <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time></p></div><button type="button" onClick={() => void handleNoteDelete(note)} className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 transition hover:border-coral hover:text-coral">Delete</button></div><p className="mt-3 whitespace-pre-wrap text-sm text-ink/80">{note.body}</p></article>)}</div> : !notesError && <p className="mt-4 rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No notes yet. Add the first private note above.</p>}</section>
      </div> : <p className="mt-4 text-sm text-ink/60">Select a member to view details.</p>}
    </section>
    {lightboxOpen && selected && <div role="dialog" aria-modal="true" aria-label="Family photograph" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5" onClick={() => setLightboxOpen(false)}><div className="relative max-h-full max-w-lg" onClick={(event) => event.stopPropagation()}><Image src={photoUrl} alt={`Photograph of the ${selected.family.lastName} family`} width={800} height={1000} className="max-h-[85vh] w-auto rounded-xl object-contain" /><button type="button" className="focus-ring absolute -right-3 -top-3 rounded-full bg-white px-3 py-1 text-xl text-ink shadow" onClick={() => setLightboxOpen(false)} aria-label="Close family photograph">×</button></div></div>}
  </div>;
}
