"use client";

import { useEffect, useMemo, useState } from "react";
import { Notification } from "@/components/ui";

type EventSummary = {
  id: string; title: string; status: string; startsAt: string; endsAt: string | null;
  eventType: string; category: string | null; location: string | null; rosterSource?: { type: string; label: string };
  visitorCount: number; attendanceCount: number; attendanceByStatus: Record<string, number>;
};
type MemberRow = {
  id: string; firstName: string; lastName: string | null; familyLastName: string;
  memberNumber: number; status: string; attendance: { status: string } | null;
};
type DirectoryMember = Omit<MemberRow, "attendance" | "status">;

const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
const eventTypeLabels: Record<string, string> = { WORSHIP: "Worship", CLASS: "Class", FELLOWSHIP: "Fellowship", OUTREACH: "Outreach", MEETING: "Meeting", OTHER: "Other" };
const eventStatusLabels: Record<string, string> = { SCHEDULED: "Scheduled", COMPLETED: "Completed", CANCELLED: "Cancelled" };

function eventDate(event: EventSummary) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  return `${start.toLocaleDateString()} · ${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${end ? `–${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}`;
}
function memberName(member: { firstName: string; lastName: string | null; familyLastName: string }) {
  return `${member.lastName ?? member.familyLastName}, ${member.firstName}`;
}

export function AttendanceManager() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventPages, setEventPages] = useState(1);
  const [eventSearch, setEventSearch] = useState("");
  const [selected, setSelected] = useState<EventSummary | null>(null);
  const [rosterSource, setRosterSource] = useState<{ type: string; label: string } | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string | null>>({});
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [visitorCount, setVisitorCount] = useState(0);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryMembers, setDirectoryMembers] = useState<DirectoryMember[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingEvents(true);
    const params = new URLSearchParams({ page: String(eventsPage), pageSize: "25", ...(eventSearch.trim() ? { search: eventSearch.trim() } : {}) });
    void fetch(`/api/membership/attendance/events?${params}`, { signal: controller.signal }).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load events.");
      setEvents(value.events ?? []);
      setEventPages(Math.max(value.pagination?.pageCount ?? 1, 1));
    }).catch((reason) => { if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message); }).finally(() => setLoadingEvents(false));
    return () => controller.abort();
  }, [eventSearch, eventsPage, reload]);

  useEffect(() => {
    if (!selected) { setMembers([]); return; }
    const controller = new AbortController();
    setLoadingMembers(true);
    void fetch(`/api/membership/attendance/events/${selected.id}/records?page=1&pageSize=100`, { signal: controller.signal }).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load attendance roster.");
      const rows: MemberRow[] = value.members ?? [];
      setMembers(rows);
      setRosterSource(value.event?.rosterSource ?? null);
      const missingRecords = rows.filter((member) => !member.attendance).map((member) => ({ individualId: member.id, status: "ABSENT" }));
      setStatuses(Object.fromEntries(rows.map((member) => [member.id, member.attendance?.status ?? "ABSENT"])));
      setSelectedMembers({});
      setVisitorCount(value.visitorCount ?? selected.visitorCount ?? 0);
      setSummary({ ...(value.summary ?? {}), ABSENT: (value.summary?.ABSENT ?? 0) + missingRecords.length });
      if (missingRecords.length && selected.status !== "CANCELLED") void saveStatuses(missingRecords, false);
    }).catch((reason) => { if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message); }).finally(() => setLoadingMembers(false));
    return () => controller.abort();
  // The save helper is declared below and intentionally captures the selected event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, reload]);

  useEffect(() => {
    if (!selected || directorySearch.trim().length < 3) { setDirectoryMembers([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/membership/attendance/events/${selected.id}/directory?search=${encodeURIComponent(directorySearch)}`, { signal: controller.signal }).then((response) => response.json()).then((value) => setDirectoryMembers(value.members ?? [])).catch((reason) => { if (reason.name !== "AbortError") setError("Unable to search the member directory."); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [directorySearch, selected]);

  function selectEvent(event: EventSummary) {
    setSelected(event); setRosterSource(event.rosterSource ?? null); setDirectorySearch(""); setMessage(""); setError("");
  }
  async function saveStatuses(records: Array<{ individualId: string; status: string | null }>, announce = true) {
    const event = selected;
    if (!event || event.status === "CANCELLED") return;
    setSubmitting(true); setError("");
    try {
      const response = await fetch(`/api/membership/attendance/events/${event.id}/records`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: records.map((record) => ({ ...record, minutesParticipated: null, notes: null })) }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to update attendance.");
      if (announce) setMessage("Attendance updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update attendance.");
    } finally { setSubmitting(false); }
  }
  async function updateStatus(id: string, status: string | null) {
    setStatuses((current) => ({ ...current, [id]: status }));
    await saveStatuses([{ individualId: id, status }]);
  }
  async function applyBulkStatus(status: string | null) {
    const ids = Object.keys(selectedMembers).filter((id) => selectedMembers[id]);
    if (!ids.length) return;
    setStatuses((current) => Object.fromEntries(Object.entries(current).map(([id, value]) => [id, ids.includes(id) ? status : value])));
    setSelectedMembers({});
    await saveStatuses(ids.map((individualId) => ({ individualId, status })));
  }
  async function saveVisitorCount() {
    if (!selected || selected.status === "CANCELLED") return;
    setSubmitting(true); setError("");
    try {
      const response = await fetch(`/api/membership/attendance/events/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitorCount }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to update visitor count.");
      setMessage("Visitor count updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update visitor count."); } finally { setSubmitting(false); }
  }
  async function addDirectoryMember(individualId: string, addToGroup: boolean) {
    if (!selected) return;
    setSubmitting(true); setError("");
    try {
      const response = await fetch(`/api/membership/attendance/events/${selected.id}/directory`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ individualId, addToGroup }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to add member.");
      setMessage(addToGroup ? "Member added to the attendance group and event." : "Member added to this event.");
      setDirectorySearch(""); setDirectoryMembers([]); setReload((current) => current + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add member."); } finally { setSubmitting(false); }
  }

  const attending = useMemo(() => Object.values(statuses).filter((status) => status === "PRESENT").length, [statuses]);
  const total = attending + Math.max(0, visitorCount);

  return <div className="mt-8 grid gap-6">
    {message && <Notification variant="success">{message}</Notification>}
    {error && <Notification variant="danger">{error}</Notification>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Membership events</h2><p className="mt-1 text-sm text-ink/60">Most recent events first.</p></div><input value={eventSearch} onChange={(event) => { setEventSearch(event.target.value); setEventsPage(1); }} placeholder="Search events" aria-label="Search events" className={inputClass} /></div>
        <div className="mt-5 grid gap-2">{events.map((event) => <button key={event.id} type="button" onClick={() => selectEvent(event)} className={`focus-ring rounded-xl border p-4 text-left transition ${selected?.id === event.id ? "border-coral bg-coral/[.07]" : "border-ink/10 hover:border-coral/40"}`}><div className="flex items-start justify-between gap-3"><span className="font-semibold">{event.title}</span><span className="rounded-full bg-mist px-2 py-1 text-xs font-semibold">{eventStatusLabels[event.status]}</span></div><p className="mt-1 text-sm text-ink/65">{eventDate(event)}</p><p className="mt-1 text-xs text-ink/55">{eventTypeLabels[event.eventType]}{event.location ? ` · ${event.location}` : ""}</p></button>)}</div>
        {!loadingEvents && !events.length && <p className="py-8 text-sm text-ink/55">No membership events found.</p>}
        <div className="mt-5 flex items-center justify-between text-sm"><button type="button" disabled={eventsPage <= 1} onClick={() => setEventsPage((page) => page - 1)} className="font-semibold text-coral disabled:text-ink/30">Previous</button><span>Page {eventsPage} of {eventPages}</span><button type="button" disabled={eventsPage >= eventPages} onClick={() => setEventsPage((page) => page + 1)} className="font-semibold text-coral disabled:text-ink/30">Next</button></div>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        {!selected ? <div className="flex min-h-64 items-center justify-center text-center text-sm text-ink/55">Select an event to take attendance.</div> : <>
          <div><h2 className="font-serif text-2xl">{selected.title}</h2><p className="mt-1 text-sm text-ink/60">Changes save automatically · {eventDate(selected)}</p>{rosterSource && <p className="mt-2 inline-flex rounded-full bg-mist px-3 py-1 text-xs font-semibold text-ink/70">Roster source: {rosterSource.label}</p>}</div>
          {selected.status === "CANCELLED" && <Notification variant="warning" className="mt-4">This event is cancelled. Attendance is read-only.</Notification>}
          <div className="mt-5 rounded-xl border border-dashed border-ink/15 bg-sand/25 p-4"><label className="grid gap-1 text-sm font-semibold">Add a member to this attendance list<input value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} placeholder="Search by last name (3+ letters)" className={inputClass} disabled={selected.status === "CANCELLED"} /></label>{directorySearch.trim().length > 0 && directorySearch.trim().length < 3 && <p className="mt-2 text-xs text-ink/55">Type at least three letters to search.</p>}{directoryMembers.length > 0 && <div className="mt-3 grid gap-2">{directoryMembers.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm"><span className="font-semibold">{memberName(member)}</span><span className="flex gap-2"><button type="button" onClick={() => void addDirectoryMember(member.id, false)} className="focus-ring rounded-lg border border-ink/15 px-2 py-1 text-xs font-semibold">This event</button><button type="button" onClick={() => void addDirectoryMember(member.id, true)} className="focus-ring rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-white">Add to group</button></span></div>)}</div>}{directorySearch.trim().length >= 3 && !directoryMembers.length && <p className="mt-2 text-xs text-ink/55">No matching members outside this attendance group.</p>}</div>
          <div className="mt-5 rounded-xl border border-ink/10 bg-mist/30 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">Bulk actions</span><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedMembers(Object.fromEntries(members.map((member) => [member.id, true])))} className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-1 text-xs font-semibold">Select all</button><button type="button" onClick={() => setSelectedMembers({})} className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-1 text-xs font-semibold">Clear selection</button>{["PRESENT", "ABSENT", "EXCUSED"].map((status) => <button key={status} type="button" disabled={!Object.values(selectedMembers).some(Boolean) || submitting || selected.status === "CANCELLED"} onClick={() => void applyBulkStatus(status)} className="focus-ring rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">Mark {status.toLowerCase()}</button>)}</div></div></div>
          <div className="mt-2 divide-y divide-ink/10">{loadingMembers ? <p className="py-8 text-center text-sm text-ink/55">Loading attendance roster…</p> : members.map((member) => <div key={member.id} role="button" tabIndex={selected.status === "CANCELLED" ? -1 : 0} onClick={() => { if (selected.status !== "CANCELLED" && !submitting && statuses[member.id] !== "PRESENT") void updateStatus(member.id, "PRESENT"); }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && selected.status !== "CANCELLED" && !submitting && statuses[member.id] !== "PRESENT") { event.preventDefault(); void updateStatus(member.id, "PRESENT"); } }} className={`flex items-center gap-3 px-2 py-3 transition ${selected.status !== "CANCELLED" ? "cursor-pointer" : ""} ${statuses[member.id] === "PRESENT" ? "bg-[#dcefe7]" : "bg-white hover:bg-mist/60"}`}><input aria-label={`Select ${memberName(member)}`} type="checkbox" checked={Boolean(selectedMembers[member.id])} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedMembers((current) => ({ ...current, [member.id]: event.target.checked }))} disabled={selected.status === "CANCELLED"} className="h-5 w-5 accent-coral" /><span className="flex-1"><span className="block font-semibold">{memberName(member)}</span><span className="text-xs text-ink/50">#{member.memberNumber}{member.status === "REMOVED" ? " · Archived" : ""}</span></span><select aria-label={`Attendance status for ${memberName(member)}`} value={statuses[member.id] ?? ""} onClick={(event) => event.stopPropagation()} onChange={(event) => void updateStatus(member.id, event.target.value || null)} disabled={selected.status === "CANCELLED" || submitting} className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-1 text-xs font-semibold"><option value="">Not recorded</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="EXCUSED">Excused</option></select></div>)}</div>
          {!loadingMembers && !members.length && <p className="py-8 text-center text-sm text-ink/55">No members are assigned to this event’s attendance group.</p>}
          <div className="mt-5 grid gap-3 border-t border-ink/10 pt-5 sm:grid-cols-2 lg:grid-cols-5"><div><span className="block text-xs font-semibold uppercase tracking-wide text-ink/55">Present</span><strong className="mt-1 block text-2xl">{summary.PRESENT ?? attending}</strong></div><div><span className="block text-xs font-semibold uppercase tracking-wide text-ink/55">Absent</span><strong className="mt-1 block text-2xl">{summary.ABSENT ?? 0}</strong></div><div><span className="block text-xs font-semibold uppercase tracking-wide text-ink/55">Excused</span><strong className="mt-1 block text-2xl">{summary.EXCUSED ?? 0}</strong></div><label className="grid gap-1 text-sm font-semibold">Visitors<input type="number" min={0} max={100000} value={visitorCount} onChange={(event) => setVisitorCount(Math.max(0, Number(event.target.value) || 0))} onBlur={() => void saveVisitorCount()} disabled={selected.status === "CANCELLED"} className={inputClass} /></label><div className="rounded-xl bg-ink px-4 py-3 text-white"><span className="block text-xs font-semibold uppercase tracking-wide text-white/65">Total attendance</span><strong className="mt-1 block text-2xl">{total}</strong></div></div>
        </>}
      </section>
    </div>
  </div>;
}
