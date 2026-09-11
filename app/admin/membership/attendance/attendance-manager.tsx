"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, Notification } from "@/components/ui";
import {
  MEMBERSHIP_ATTENDANCE_STATUSES,
  MEMBERSHIP_EVENT_STATUSES,
  MEMBERSHIP_EVENT_TYPES,
  MEMBERSHIP_PARTICIPATION_TYPES
} from "@/lib/membership-attendance";

type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  status: string;
  category: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  timeZone: string | null;
  attendanceCount: number;
  attendanceByStatus: Record<string, number>;
};

type AttendanceDraft = {
  status: string;
  participationType: string;
  minutesParticipated: string;
  notes: string;
};

type MemberRow = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  familyLastName: string;
  memberNumber: number;
  status: string;
  attendance: null | {
    status: string;
    participationType: string;
    minutesParticipated: number | null;
    notes: string | null;
  };
};

const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
const eventTypeLabels: Record<string, string> = { WORSHIP: "Worship", CLASS: "Class", FELLOWSHIP: "Fellowship", OUTREACH: "Outreach", MEETING: "Meeting", OTHER: "Other" };
const eventStatusLabels: Record<string, string> = { SCHEDULED: "Scheduled", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const attendanceLabels: Record<string, string> = { PRESENT: "Present", ABSENT: "Absent", EXCUSED: "Excused" };
const participationLabels: Record<string, string> = { ATTENDEE: "Attendee", VOLUNTEER: "Volunteer", LEADER: "Leader", PERFORMER: "Performer", OTHER: "Other" };

function eventDate(event: EventSummary) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  return `${start.toLocaleString()}${end ? ` – ${end.toLocaleString()}` : ""}`;
}

function memberName(member: MemberRow) {
  const last = member.lastName ?? member.familyLastName;
  const middle = member.middleName?.trim().charAt(0);
  return `${last}, ${member.firstName}${middle ? ` ${middle}.` : ""}`;
}

function initialDraft(member: MemberRow): AttendanceDraft {
  return {
    status: member.attendance?.status ?? "",
    participationType: member.attendance?.participationType ?? "ATTENDEE",
    minutesParticipated: member.attendance?.minutesParticipated?.toString() ?? "",
    notes: member.attendance?.notes ?? ""
  };
}

export function AttendanceManager() {
  const createForm = useRef<HTMLFormElement>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventPages, setEventPages] = useState(1);
  const [eventSearch, setEventSearch] = useState("");
  const [eventStatus, setEventStatus] = useState("all");
  const [selected, setSelected] = useState<EventSummary | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [memberPages, setMemberPages] = useState(1);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reloadEvents, setReloadEvents] = useState(0);
  const selectedEventId = selected?.id;

  useEffect(() => {
    const controller = new AbortController();
    setLoadingEvents(true);
    const params = new URLSearchParams({ page: String(eventsPage), pageSize: "25", status: eventStatus, ...(eventSearch.trim() ? { search: eventSearch.trim() } : {}) });
    void fetch(`/api/membership/attendance/events?${params}`, { signal: controller.signal }).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load events.");
      setEvents(value.events ?? []);
      setEventPages(Math.max(value.pagination?.pageCount ?? 1, 1));
    }).catch((reason) => {
      if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
    }).finally(() => setLoadingEvents(false));
    return () => controller.abort();
  }, [eventSearch, eventStatus, eventsPage, reloadEvents]);

  useEffect(() => {
    if (!selectedEventId) {
      setMembers([]);
      setDrafts({});
      return;
    }
    const controller = new AbortController();
    setLoadingMembers(true);
    const params = new URLSearchParams({ page: String(memberPage), pageSize: "50", ...(memberSearch.trim() ? { search: memberSearch.trim() } : {}) });
    void fetch(`/api/membership/attendance/events/${selectedEventId}/records?${params}`, { signal: controller.signal }).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load members.");
      const rows: MemberRow[] = value.members ?? [];
      setMembers(rows);
      setDrafts(Object.fromEntries(rows.map((member) => [member.id, initialDraft(member)])));
      setDirty(new Set());
      setSummary(value.summary ?? {});
      setMemberPages(Math.max(value.pagination?.pageCount ?? 1, 1));
    }).catch((reason) => {
      if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
    }).finally(() => setLoadingMembers(false));
    return () => controller.abort();
  }, [selectedEventId, memberPage, memberSearch]);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    try {
      const startsAt = new Date(values.startsAt);
      const endsAt = values.endsAt ? new Date(values.endsAt) : null;
      if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new Error("Enter a valid event date and time.");
      const response = await fetch("/api/membership/attendance/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() ?? null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to create event.");
      createForm.current?.reset();
      setSelected(value.event);
      setMemberPage(1);
      setMessage("Event created.");
      setReloadEvents((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create event.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateEventStatus(event: EventSummary, status: string) {
    if (status === "CANCELLED" && !window.confirm(`Cancel “${event.title}”? Existing attendance will remain read-only.`)) return;
    setError("");
    const response = await fetch(`/api/membership/attendance/events/${event.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to update event."); return; }
    setEvents((current) => current.map((item) => item.id === event.id ? { ...item, status } : item));
    if (selected?.id === event.id) setSelected((current) => current ? { ...current, status } : null);
    setMessage("Event status updated.");
  }

  async function deleteEvent(event: EventSummary) {
    if (!window.confirm(`Delete “${event.title}”? Only events without attendance can be deleted.`)) return;
    const response = await fetch(`/api/membership/attendance/events/${event.id}`, { method: "DELETE" });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to delete event."); return; }
    if (selected?.id === event.id) setSelected(null);
    setMessage("Event deleted.");
    setReloadEvents((current) => current + 1);
  }

  function selectEvent(event: EventSummary) {
    if (dirty.size && !window.confirm("Discard unsaved attendance changes?")) return;
    setSelected(event);
    setMemberPage(1);
    setMemberSearch("");
    setMessage("");
    setError("");
  }

  function updateDraft(id: string, update: Partial<AttendanceDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...update } }));
    setDirty((current) => new Set(current).add(id));
  }

  function markVisiblePresent() {
    setDrafts((current) => Object.fromEntries(members.map((member) => [member.id, { ...current[member.id], status: "PRESENT" }])));
    setDirty(new Set(members.map((member) => member.id)));
  }

  async function saveAttendance() {
    if (!selected || !dirty.size) return;
    setSubmitting(true);
    setError("");
    const records = Array.from(dirty).map((individualId) => ({ individualId, ...drafts[individualId] }));
    try {
      const response = await fetch(`/api/membership/attendance/events/${selected.id}/records`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to save attendance.");
      setMessage(`${value.saved} attendance record${value.saved === 1 ? "" : "s"} saved${value.removed ? `; ${value.removed} cleared` : ""}.`);
      setDirty(new Set());
      setReloadEvents((current) => current + 1);
      const params = new URLSearchParams({ page: String(memberPage), pageSize: "50", ...(memberSearch.trim() ? { search: memberSearch.trim() } : {}) });
      const refreshed = await fetch(`/api/membership/attendance/events/${selected.id}/records?${params}`).then((result) => result.json());
      if (refreshed.members) {
        setMembers(refreshed.members);
        setDrafts(Object.fromEntries(refreshed.members.map((member: MemberRow) => [member.id, initialDraft(member)])));
        setSummary(refreshed.summary ?? {});
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save attendance.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="mt-8 grid gap-6">
    {message && <Notification variant="success">{message}</Notification>}
    {error && <Notification variant="danger">{error}</Notification>}

    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl">Create an event</h2>
      <form ref={createForm} onSubmit={(event) => void createEvent(event)} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-sm font-semibold md:col-span-2">Title<input required name="title" maxLength={120} className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-semibold">Type<select name="eventType" defaultValue="WORSHIP" className={inputClass}>{MEMBERSHIP_EVENT_TYPES.map((type) => <option key={type} value={type}>{eventTypeLabels[type]}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Category<input name="category" maxLength={100} placeholder="Optional reporting category" className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-semibold">Starts<input required type="datetime-local" name="startsAt" className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-semibold">Ends<input type="datetime-local" name="endsAt" className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-semibold md:col-span-2">Location<input name="location" maxLength={200} className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-semibold md:col-span-2 xl:col-span-3">Description<textarea name="description" maxLength={2000} rows={2} className={inputClass} /></label>
        <div className="flex items-end"><Button disabled={submitting}>{submitting ? "Creating…" : "Create event"}</Button></div>
      </form>
    </section>

    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-serif text-2xl">Membership events</h2><p className="mt-1 text-sm text-ink/60">Select an event to record attendance.</p></div>
        <div className="flex flex-wrap gap-2">
          <input value={eventSearch} onChange={(event) => { setEventSearch(event.target.value); setEventsPage(1); }} placeholder="Search events" aria-label="Search events" className={inputClass} />
          <select value={eventStatus} onChange={(event) => { setEventStatus(event.target.value); setEventsPage(1); }} aria-label="Filter event status" className={inputClass}><option value="all">All statuses</option>{MEMBERSHIP_EVENT_STATUSES.map((status) => <option key={status} value={status}>{eventStatusLabels[status]}</option>)}</select>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {events.map((event) => <article key={event.id} className={`rounded-xl border p-4 ${selected?.id === event.id ? "border-coral bg-sand/30" : "border-ink/10"}`}>
          <button type="button" onClick={() => selectEvent(event)} className="focus-ring w-full rounded-lg text-left">
            <div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{event.title}</h3><span className="rounded-full bg-mist px-2 py-1 text-xs font-semibold">{eventStatusLabels[event.status]}</span></div>
            <p className="mt-1 text-sm text-ink/65">{eventDate(event)}</p>
            <p className="mt-1 text-sm text-ink/55">{eventTypeLabels[event.eventType]}{event.category ? ` · ${event.category}` : ""}{event.location ? ` · ${event.location}` : ""}</p>
            <p className="mt-2 text-xs font-semibold text-ink/60">{event.attendanceCount} recorded · {event.attendanceByStatus.PRESENT ?? 0} present · {event.attendanceByStatus.ABSENT ?? 0} absent · {event.attendanceByStatus.EXCUSED ?? 0} excused</p>
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
            <label className="text-xs font-semibold">Status <select value={event.status} onChange={(change) => void updateEventStatus(event, change.target.value)} className="focus-ring ml-1 rounded-lg border border-ink/15 bg-white px-2 py-1">{MEMBERSHIP_EVENT_STATUSES.map((status) => <option key={status} value={status}>{eventStatusLabels[status]}</option>)}</select></label>
            <button type="button" onClick={() => void deleteEvent(event)} className="ml-auto text-xs font-semibold text-coral">Delete</button>
          </div>
        </article>)}
        {!loadingEvents && !events.length && <p className="text-sm text-ink/55">No events match this filter.</p>}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm"><button type="button" disabled={eventsPage <= 1} onClick={() => setEventsPage((page) => page - 1)} className="font-semibold text-coral disabled:text-ink/30">Previous</button><span>Page {eventsPage} of {eventPages}</span><button type="button" disabled={eventsPage >= eventPages} onClick={() => setEventsPage((page) => page + 1)} className="font-semibold text-coral disabled:text-ink/30">Next</button></div>
    </section>

    {selected && <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Record attendance</p><h2 className="mt-1 font-serif text-2xl">{selected.title}</h2><p className="mt-1 text-sm text-ink/60">{eventDate(selected)}</p></div>
        <div className="text-sm text-ink/65">{summary.PRESENT ?? 0} present · {summary.ABSENT ?? 0} absent · {summary.EXCUSED ?? 0} excused</div>
      </div>
      {selected.status === "CANCELLED" && <Notification variant="warning" className="mt-4">This event is cancelled. Its attendance history is read-only.</Notification>}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1 text-sm font-semibold">Search members<input disabled={dirty.size > 0} value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setMemberPage(1); }} placeholder="Name" className={inputClass} /><span className="text-xs font-normal text-ink/50">{dirty.size ? "Save or discard changes before searching." : "Search by first or last name."}</span></label>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="default" disabled={selected.status === "CANCELLED" || loadingMembers || !members.length} onClick={markVisiblePresent}>Mark page present</Button><Button type="button" disabled={selected.status === "CANCELLED" || submitting || !dirty.size} onClick={() => void saveAttendance()}>{submitting ? "Saving…" : `Save changes${dirty.size ? ` (${dirty.size})` : ""}`}</Button></div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead><tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/55"><th className="p-2">Member</th><th className="p-2">Attendance</th><th className="p-2">Participation</th><th className="p-2">Minutes</th><th className="p-2">Notes</th></tr></thead>
          <tbody>{members.map((member) => {
            const draft = drafts[member.id] ?? initialDraft(member);
            const disabled = selected.status === "CANCELLED";
            return <tr key={member.id} className={`border-b border-ink/5 ${dirty.has(member.id) ? "bg-amber-50" : ""}`}>
              <td className="p-2"><p className="font-semibold">{memberName(member)}</p><p className="text-xs text-ink/50">#{member.memberNumber}{member.status === "REMOVED" ? " · Archived" : ""}</p></td>
              <td className="p-2"><select disabled={disabled} value={draft.status} onChange={(event) => updateDraft(member.id, { status: event.target.value })} className={inputClass}><option value="">Not recorded</option>{MEMBERSHIP_ATTENDANCE_STATUSES.map((status) => <option key={status} value={status}>{attendanceLabels[status]}</option>)}</select></td>
              <td className="p-2"><select disabled={disabled || !draft.status} value={draft.participationType} onChange={(event) => updateDraft(member.id, { participationType: event.target.value })} className={inputClass}>{MEMBERSHIP_PARTICIPATION_TYPES.map((type) => <option key={type} value={type}>{participationLabels[type]}</option>)}</select></td>
              <td className="p-2"><input disabled={disabled || !draft.status} type="number" min={0} max={10080} value={draft.minutesParticipated} onChange={(event) => updateDraft(member.id, { minutesParticipated: event.target.value })} className={`${inputClass} w-24`} aria-label={`Minutes for ${memberName(member)}`} /></td>
              <td className="p-2"><input disabled={disabled || !draft.status} maxLength={500} value={draft.notes} onChange={(event) => updateDraft(member.id, { notes: event.target.value })} className={`${inputClass} w-full min-w-48`} aria-label={`Notes for ${memberName(member)}`} /></td>
            </tr>;
          })}</tbody>
        </table>
        {!loadingMembers && !members.length && <p className="py-6 text-center text-sm text-ink/55">No members match this search.</p>}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm"><button type="button" disabled={memberPage <= 1 || dirty.size > 0} onClick={() => setMemberPage((page) => page - 1)} className="font-semibold text-coral disabled:text-ink/30">Previous</button><span>Page {memberPage} of {memberPages}{dirty.size ? " · Save or discard changes before paging" : ""}</span><button type="button" disabled={memberPage >= memberPages || dirty.size > 0} onClick={() => setMemberPage((page) => page + 1)} className="font-semibold text-coral disabled:text-ink/30">Next</button></div>
    </section>}
  </div>;
}
