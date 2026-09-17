"use client";

import { type FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { formatPhoneNumber } from "@/lib/phone-numbers";
import { MembershipTimeline } from "@/app/admin/membership/membership-timeline";
import { preferredContactMethodLabel } from "@/lib/membership-contact-preferences";

type Member = {
  id: string; firstName: string; middleName: string | null; lastName: string | null; birthday: string;
  ageCategoryOverride: string | null; cellphone: string | null; otherPhone: string | null; otherPhoneType: string | null;
  email: string | null; memberNumber: number; envelopeNumber: string | null; gradeLevel: string | null; maritalStatus: string; weddingDate: string | null;
  deceasedDate: string | null; gender: string; status: string; familyRole: { name: string };
  preferredContactMethod: string; doNotContact: boolean; communicationNotes: string | null; relationshipNotes: string | null;
  memberType: { name: string }; family: Record<string, string | boolean | null> & { individuals: { id: string; firstName: string; lastName: string | null; familyRole: { name: string } }[] };
};
type Row = { id: string; firstName: string; middleName: string | null; lastName: string | null; familyLastName: string; memberNumber: number; envelopeNumber: string | null; memberType: string; familyRole: string; status: string; directoryListed: boolean };
type Note = { id: string; individualId: string; reason: string; body: string; createdAt: string; updatedAt: string; author: { id: string; name: string } };

function formatMemberName(member: Pick<Row, "firstName" | "middleName" | "lastName" | "familyLastName">) {
  const lastName = member.lastName ?? member.familyLastName;
  const middleInitial = member.middleName?.trim().charAt(0);
  return `${lastName}, ${member.firstName}${middleInitial ? ` ${middleInitial}.` : ""}`;
}

export function MembershipDirectory() {
  const [members, setMembers] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [types, setTypes] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [memberType, setMemberType] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [dynamicListId, setDynamicListId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("dynamicListId") ?? "");
  const [selectedMemberId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("id") ?? "");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [noteReason, setNoteReason] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkUndoId, setBulkUndoId] = useState("");
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [bulkType, setBulkType] = useState("");
  const [bulkRole, setBulkRole] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkGroupOpen, setBulkGroupOpen] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string; type: "volunteer-group" | "manual-list" }[]>([]);
  const photoUrl = selected && typeof selected.family.photographUrl === "string" && selected.family.photographUrl ? selected.family.photographUrl : "/no-family-photo.jpg";
  const selectedId = selected?.id;

  useEffect(() => {
    const params = new URLSearchParams({ status: dynamicListId ? "all" : statusFilter, ...(dynamicListId ? { dynamicListId } : {}), ...(selectedMemberId ? { id: selectedMemberId } : {}), ...(search ? { search } : {}), ...(memberType ? { memberType } : {}) });
    void fetch(`/api/membership?${params}`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load the selected dynamic list.");
      return response.json();
    }).then((value) => {
      if (value) {
        setMembers(value.members);
        setTypes(value.types);
        setSelected(value.selected);
        setSelectedIds((current) => new Set(Array.from(current).filter((id) => value.members.some((member: Row) => member.id === id))));
      }
    }).catch(() => setBulkMessage("Unable to load the selected dynamic list."));
  }, [search, memberType, statusFilter, dynamicListId, selectedMemberId]);
  useEffect(() => {
    void fetch("/api/membership/reference").then((response) => response.ok ? response.json() : null).then((value) => {
      if (value) setRoles(value.roles);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    void Promise.all([fetch("/api/membership/volunteer-groups"), fetch("/api/membership/manual-lists")]).then(async ([volunteerResponse, manualResponse]) => {
      const [volunteer, manual] = await Promise.all([volunteerResponse.json(), manualResponse.json()]);
      setGroups([
        ...(volunteer.groups ?? []).map((group: { id: string; name: string }) => ({ ...group, type: "volunteer-group" as const })),
        ...(manual.lists ?? []).map((list: { id: string; name: string }) => ({ id: list.id, name: list.name, type: "manual-list" as const }))
      ]);
    }).catch(() => undefined);
  }, []);

  const allVisibleSelected = members.length > 0 && members.every((member) => selectedIds.has(member.id));
  function toggleMember(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) members.forEach((member) => next.delete(member.id));
      else members.forEach((member) => next.add(member.id));
      return next;
    });
  }
  async function updateSelected(action: "archive" | "restore") {
    const verb = action === "archive" ? "Archive" : "Restore";
    if (!selectedIds.size || !window.confirm(`${verb} ${selectedIds.size} selected member${selectedIds.size === 1 ? "" : "s"}?`)) return;
    setBulkSubmitting(true);
    setBulkMessage("");
    try {
      const response = await fetch("/api/membership/individuals/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, memberIds: Array.from(selectedIds) })
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to archive selected members.");
      setSelectedIds(new Set());
      setSelected(null);
      setBulkUndoId(value.undoId ?? "");
      setBulkMessage(`${value.updatedCount} member${value.updatedCount === 1 ? "" : "s"} ${action === "archive" ? "archived" : "restored"}.`);
      const params = new URLSearchParams({ status: dynamicListId ? "all" : statusFilter, ...(dynamicListId ? { dynamicListId } : {}), ...(search ? { search } : {}), ...(memberType ? { memberType } : {}) });
      const refreshed = await fetch(`/api/membership?${params}`).then((result) => result.json());
      if (refreshed) setMembers(refreshed.members);
    } catch (reason) {
      setBulkMessage(reason instanceof Error ? reason.message : "Unable to archive selected members.");
    } finally {
      setBulkSubmitting(false);
    }
  }
  async function bulkEditSelected() {
      const updates = { ...(bulkType ? { memberTypeId: bulkType } : {}), ...(bulkRole ? { familyRoleId: bulkRole } : {}), ...(bulkStatus ? { status: bulkStatus } : {}) };
      if (!selectedIds.size || !Object.keys(updates).length) {
        setBulkMessage("Choose at least one field to update.");
        return;
      }
      if (!window.confirm(`Update ${selectedIds.size} selected member${selectedIds.size === 1 ? "" : "s"}?`)) return;
      setBulkSubmitting(true);
      setBulkMessage("");
      try {
        const response = await fetch("/api/membership/individuals/bulk", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", memberIds: Array.from(selectedIds), ...updates }) });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "Unable to update selected members.");
        setBulkMessage(`${value.updatedCount} member${value.updatedCount === 1 ? "" : "s"} updated.`);
        setBulkUndoId(value.undoId ?? "");
        setBulkType("");
        setBulkRole("");
        setBulkStatus("");
        setSelectedIds(new Set());
        const params = new URLSearchParams({ status: dynamicListId ? "all" : statusFilter, ...(dynamicListId ? { dynamicListId } : {}), ...(search ? { search } : {}), ...(memberType ? { memberType } : {}) });
        const refreshed = await fetch(`/api/membership?${params}`).then((result) => result.json());
        if (refreshed) setMembers(refreshed.members);
      } catch (reason) {
        setBulkMessage(reason instanceof Error ? reason.message : "Unable to update selected members.");
      } finally {
        setBulkSubmitting(false);
    }
  }
  async function addSelectedToGroup() {
    if (!selectedIds.size || !bulkGroupId) {
      setBulkMessage("Choose a group.");
      return;
    }
    setBulkSubmitting(true);
    setBulkMessage("");
    try {
      const target = groups.find((group) => `${group.type}:${group.id}` === bulkGroupId);
      const response = await fetch("/api/membership/individuals/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-to-group", memberIds: Array.from(selectedIds), groupId: target?.id, audienceType: target?.type })
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to add selected members to the group.");
      setBulkGroupOpen(false);
      setBulkGroupId("");
      setSelectedIds(new Set());
      setBulkMessage(`${value.updatedCount} member${value.updatedCount === 1 ? "" : "s"} added to ${value.groupName}.${value.alreadyAssigned ? ` ${value.alreadyAssigned} already assigned.` : ""}`);
    } catch (reason) {
      setBulkMessage(reason instanceof Error ? reason.message : "Unable to add selected members to the group.");
    } finally {
      setBulkSubmitting(false);
    }
  }
    async function undoBulkAction() {
      if (!bulkUndoId) return;
      setBulkSubmitting(true);
      try {
        const response = await fetch("/api/membership/individuals/bulk/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId: bulkUndoId }) });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "Unable to undo the bulk action.");
        setBulkUndoId("");
        setBulkMessage(`${value.restored} member${value.restored === 1 ? "" : "s"} restored to their previous values.`);
        window.location.reload();
      } catch (reason) {
        setBulkMessage(reason instanceof Error ? reason.message : "Unable to undo the bulk action.");
      } finally {
        setBulkSubmitting(false);
      }
    }

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
    <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-serif text-2xl">Members</h2>{dynamicListId && <a href="/admin/membership" className="text-sm font-semibold text-coral">Clear dynamic list</a>}</div>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Search by name<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="First or last name" className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Member type<select value={memberType} onChange={(event) => setMemberType(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">All types</option>{types.map((type) => <option key={type.slug} value={type.slug}>{type.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Record status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="active">Active members</option><option value="inactive">Inactive members</option><option value="deceased">Deceased members</option><option value="archived">Archived members</option><option value="all">All members</option></select></label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-ink/10 py-3">
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /> Select all visible</label>
        {selectedIds.size > 0 && <details className="relative"><summary className="focus-ring list-none cursor-pointer rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white">Bulk actions <span aria-hidden="true">⌄</span></summary><div className="absolute right-0 z-10 mt-2 grid min-w-48 gap-1 rounded-xl border border-ink/10 bg-white p-2 shadow-lg"><button type="button" className="focus-ring rounded-lg px-3 py-2 text-left text-sm hover:bg-mist" onClick={() => { const params = new URLSearchParams(); Array.from(selectedIds).forEach((id) => params.append("memberIds", id)); window.location.href = `/admin/membership/messaging?${params.toString()}`; }}>Message selected</button><button type="button" className="focus-ring rounded-lg px-3 py-2 text-left text-sm hover:bg-mist" onClick={() => setBulkGroupOpen(true)}>Add to group</button><button type="button" className="focus-ring rounded-lg px-3 py-2 text-left text-sm hover:bg-mist" onClick={() => setBulkEditOpen(true)}>Bulk modify</button>{members.some((member) => selectedIds.has(member.id) && member.status !== "REMOVED") && <button type="button" disabled={bulkSubmitting} onClick={() => void updateSelected("archive")} className="focus-ring rounded-lg px-3 py-2 text-left text-sm text-coral hover:bg-mist disabled:opacity-60">Archive selected</button>}{members.some((member) => selectedIds.has(member.id) && member.status === "REMOVED") && <button type="button" disabled={bulkSubmitting} onClick={() => void updateSelected("restore")} className="focus-ring rounded-lg px-3 py-2 text-left text-sm hover:bg-mist disabled:opacity-60">Restore selected</button>}</div></details>}
        {bulkGroupOpen && <div role="dialog" aria-modal="true" aria-labelledby="bulk-group-heading" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-5"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-coral">Add to group</p><h3 id="bulk-group-heading" className="mt-1 font-serif text-2xl">{selectedIds.size} selected member{selectedIds.size === 1 ? "" : "s"}</h3></div><button type="button" className="focus-ring rounded-full px-2 py-1 text-xl text-ink/60 hover:text-coral" onClick={() => setBulkGroupOpen(false)} aria-label="Close add to group dialog">×</button></div><p className="mt-3 text-sm text-ink/60">Choose a volunteer or manual group. Dynamic groups are not included. Existing assignments are skipped.</p><label className="mt-5 grid gap-1 text-sm font-semibold">Group<select value={bulkGroupId} onChange={(event) => setBulkGroupId(event.target.value)} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="">Select a group</option>{groups.map((group) => <option key={`${group.type}-${group.id}`} value={`${group.type}:${group.id}`}>{group.name} · {group.type === "manual-list" ? "Manual group" : "Volunteer group"}</option>)}</select></label><div className="mt-6 flex justify-end gap-3"><button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" onClick={() => setBulkGroupOpen(false)}>Cancel</button><button type="button" disabled={bulkSubmitting || !bulkGroupId} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => void addSelectedToGroup()}>Add members</button></div></div></div>}
        {bulkEditOpen && <div role="dialog" aria-modal="true" aria-labelledby="bulk-edit-heading" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-5"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-coral">Bulk modify</p><h3 id="bulk-edit-heading" className="mt-1 font-serif text-2xl">{selectedIds.size} selected member{selectedIds.size === 1 ? "" : "s"}</h3></div><button type="button" className="focus-ring rounded-full px-2 py-1 text-xl text-ink/60 hover:text-coral" onClick={() => setBulkEditOpen(false)} aria-label="Close bulk modify dialog">×</button></div><p className="mt-3 text-sm text-ink/60">Only fields with a new value will be changed.</p><div className="mt-5 grid gap-3"><label className="grid gap-1 text-sm font-semibold">Member type<select value={bulkType} onChange={(event) => setBulkType(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">Keep current</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Family role<select value={bulkRole} onChange={(event) => setBulkRole(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">Keep current</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Status<select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal"><option value="">Keep current</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="DECEASED">Deceased</option></select></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" onClick={() => setBulkEditOpen(false)}>Cancel</button><button type="button" disabled={bulkSubmitting} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={() => { setBulkEditOpen(false); void bulkEditSelected(); }}>Apply changes</button></div></div></div>}
      </div>
      {bulkMessage && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-coral"><p role="status">{bulkMessage}</p>{bulkUndoId && <button type="button" disabled={bulkSubmitting} onClick={() => void undoBulkAction()} className="focus-ring rounded-full border border-coral px-3 py-1 font-semibold text-coral disabled:opacity-60">Undo</button>}</div>}
      <div className="mt-3 grid gap-1" aria-live="polite">{members.map((member) => <div key={member.id} className={`flex items-center gap-2 rounded-lg p-2 hover:bg-mist ${selected?.id === member.id ? "bg-mist" : ""}`}><input type="checkbox" checked={selectedIds.has(member.id)} onChange={() => toggleMember(member.id)} aria-label={`Select ${formatMemberName(member)}`} /><button type="button" onClick={() => void fetch(`/api/membership?id=${member.id}`).then((response) => response.json()).then((value) => setSelected(value.selected))} className="focus-ring min-w-0 flex-1 p-1 text-left"><span className="block font-semibold">{formatMemberName(member)}</span><span className="text-xs text-ink/55">#{member.memberNumber} · {member.familyRole} · {member.memberType} · {member.status.toLowerCase()}{member.directoryListed ? "" : " · directory hidden"}</span></button></div>)}</div>
      {!members.length && <p className="mt-5 text-sm text-ink/60">No members match these filters.</p>}
    </section>
    <section className="self-start rounded-2xl border border-ink/10 bg-white p-6 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <h2 className="font-serif text-2xl">Member details</h2>
      {selected ? <div className="mt-5 grid gap-6">
        <div className="flex flex-wrap justify-end gap-2"><a className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral" href={`/admin/membership/workflows?targetId=${selected.id}`}>Apply workflow</a><a className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral" href={`/admin/membership/individuals/${selected.id}/edit`}>Edit individual</a><a className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral" href={`/admin/membership/families/${selected.family.id}/edit`}>Edit family</a></div>
        <div><p className="text-sm font-semibold uppercase tracking-wider text-coral">Individual</p><h3 className="mt-1 font-serif text-3xl">{selected.firstName} {selected.middleName} {selected.lastName ?? selected.family.lastName}</h3><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{[["Member number", selected.memberNumber], ["Envelope / giving number", selected.envelopeNumber], ["Member type", selected.memberType.name], ["Family role", selected.familyRole.name], ["Relationship details", selected.relationshipNotes], ["Status", selected.status], ["Birthday", new Date(selected.birthday).toLocaleDateString()], ["Age category", selected.ageCategoryOverride ?? "Calculated"], ["Gender", selected.gender], ["Marital status", selected.maritalStatus], ["Grade level", selected.gradeLevel], ["Cellphone", formatPhoneNumber(selected.cellphone)], ["Other phone", `${formatPhoneNumber(selected.otherPhone)} ${selected.otherPhoneType ? `(${selected.otherPhoneType})` : ""}`], ["Email", selected.email], ["Preferred contact", preferredContactMethodLabel(selected.preferredContactMethod)], ["Do not contact", selected.doNotContact ? "Yes" : "No"], ["Communication notes", selected.communicationNotes], ["Wedding date", selected.weddingDate ? new Date(selected.weddingDate).toLocaleDateString() : "—"], ["Deceased date", selected.deceasedDate ? new Date(selected.deceasedDate).toLocaleDateString() : "—"]].map(([label, value]) => <div key={String(label)}><dt className="font-semibold text-ink/60">{label}</dt><dd className="whitespace-pre-wrap">{value || "—"}</dd></div>)}</dl></div>
        <div className="border-t border-ink/10 pt-5"><p className="text-sm font-semibold uppercase tracking-wider text-coral">Family</p><div className="mt-3 grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]"><button type="button" className="focus-ring block aspect-[4/5] overflow-hidden rounded-xl bg-mist" onClick={() => setLightboxOpen(true)} aria-label="Open family photograph"><Image src={photoUrl} alt={`Photograph of the ${selected.family.lastName} family`} width={320} height={400} className="h-full w-full object-cover" /></button><div><h3 className="font-serif text-2xl">{selected.family.familyNameOverride || selected.family.lastName}</h3><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{[["Formal greeting", selected.family.formalGreeting], ["Informal greeting", selected.family.informalGreeting], ["Address", [selected.family.addressStreet, selected.family.addressCity, selected.family.addressState, selected.family.addressZip].filter(Boolean).join(", ")], ["Secondary address", [selected.family.secondaryStreet, selected.family.secondaryCity, selected.family.secondaryState, selected.family.secondaryZip].filter(Boolean).join(", ")], ["Phone", formatPhoneNumber(selected.family.phone)], ["Phone type", selected.family.phoneIsMobile ? "Cellphone" : "Land line"], ["Email", selected.family.email], ["Status", selected.family.status]].map(([label, value]) => <div key={String(label)}><dt className="font-semibold text-ink/60">{label}</dt><dd>{value || "—"}</dd></div>)}</dl></div></div></div>
        <div className="border-t border-ink/10 pt-5"><p className="text-sm font-semibold uppercase tracking-wider text-coral">Family members</p><div className="mt-3 grid gap-2">{selected.family.individuals.map((member) => <a key={member.id} href={`/admin/membership?id=${member.id}`} className="focus-ring flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 transition hover:border-coral hover:bg-mist"><span className="font-semibold">{member.firstName} {member.lastName ?? selected.family.lastName}</span><span className="text-sm text-ink/60">{member.familyRole.name}</span></a>)}</div></div>
        <MembershipTimeline key={`${selected.id}:${notes.map((note) => note.id).join(",")}`} individualId={selected.id} />
        <section className="border-t border-ink/10 pt-5" aria-labelledby="membership-notes-heading"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><p className="text-sm font-semibold uppercase tracking-wider text-coral">Private record</p><h3 id="membership-notes-heading" className="mt-1 font-serif text-2xl">Notes</h3></div><p className="text-xs text-ink/55">Visible to membership managers</p></div><form onSubmit={handleNoteSubmit} className="mt-4 grid gap-3 rounded-xl bg-mist/60 p-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"><label className="grid gap-1 text-sm font-semibold" htmlFor="note-reason">Reason<input id="note-reason" value={noteReason} onChange={(event) => setNoteReason(event.target.value)} maxLength={120} required placeholder="Pastoral care, follow-up..." className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold" htmlFor="note-body">Note<textarea id="note-body" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} maxLength={5000} required rows={3} placeholder="Add a private note about this member..." className="focus-ring resize-y rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /></label></div><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-ink/55">Keep notes factual and relevant to member care.</span><button type="submit" disabled={noteSubmitting} className="focus-ring rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d95f43] disabled:cursor-not-allowed disabled:opacity-60">{noteSubmitting ? "Saving..." : "Add note"}</button></div></form>{notesError && <p role="alert" className="mt-3 text-sm text-coral">{notesError}</p>}{notesLoading ? <p className="mt-4 text-sm text-ink/60">Loading notes...</p> : notes.length ? <div className="mt-4 grid gap-3">{notes.map((note) => <article key={note.id} className="rounded-xl border border-ink/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{note.reason}</p><p className="mt-1 text-xs text-ink/55">{note.author.name} · <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time></p></div><button type="button" onClick={() => void handleNoteDelete(note)} className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 transition hover:border-coral hover:text-coral">Delete</button></div><p className="mt-3 whitespace-pre-wrap text-sm text-ink/80">{note.body}</p></article>)}</div> : !notesError && <p className="mt-4 rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No notes yet. Add the first private note above.</p>}</section>
      </div> : <p className="mt-4 text-sm text-ink/60">Select a member to view details.</p>}
    </section>
    {lightboxOpen && selected && <div role="dialog" aria-modal="true" aria-label="Family photograph" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5" onClick={() => setLightboxOpen(false)}><div className="relative max-h-full max-w-lg" onClick={(event) => event.stopPropagation()}><Image src={photoUrl} alt={`Photograph of the ${selected.family.lastName} family`} width={800} height={1000} className="max-h-[85vh] w-auto rounded-xl object-contain" /><button type="button" className="focus-ring absolute -right-3 -top-3 rounded-full bg-white px-3 py-1 text-xl text-ink shadow" onClick={() => setLightboxOpen(false)} aria-label="Close family photograph">×</button></div></div>}
  </div>;
}
