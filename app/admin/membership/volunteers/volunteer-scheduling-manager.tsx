"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, Notification } from "@/components/ui";
import { SERVICE_ASSIGNMENT_STATUSES, SERVICE_OUTCOMES, SERVICE_SHIFT_STATUSES } from "@/lib/membership-volunteers";

type Group = { id: string; name: string; memberCount: number };
type Opportunity = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  defaultRole: string | null;
  isActive: boolean;
  group: { id: string; name: string };
  eventTeams?: { groupId: string; volunteersNeeded: number; group: { id: string; name: string } }[];
  _count: { shifts: number };
};
type Shift = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  capacity: number | null;
  notes: string | null;
  opportunity: { id: string; title: string; location: string | null; defaultRole: string | null; group: { id: string; name: string }; eventTeams?: { groupId: string; volunteersNeeded: number; group: { id: string; name: string } }[] };
  _count: { assignments: number };
};
type Member = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  familyLastName: string;
  memberNumber: number;
  status: string;
  groupMembership: { role: string | null; isLeader: boolean; assignedAt: string } | null;
  lastGroupAssignmentChange: { action: string; createdAt: string } | null;
  assignment: {
    role: string | null;
    status: string;
    serviceRecord: { outcome: string; minutesServed: number | null; notes: string | null; recordedAt: string } | null;
  } | null;
};
type Draft = { assigned: boolean; status: string; role: string; outcome: string; minutesServed: string; notes: string };

const inputClass = "focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2";
const shiftStatusLabels: Record<string, string> = { SCHEDULED: "Scheduled", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const assignmentStatusLabels: Record<string, string> = { ASSIGNED: "Assigned", CONFIRMED: "Confirmed", CANCELLED: "Cancelled" };
const outcomeLabels: Record<string, string> = { COMPLETED: "Completed", NO_SHOW: "No-show" };

function memberName(member: Member) {
  const middle = member.middleName?.trim().charAt(0);
  return `${member.lastName ?? member.familyLastName}, ${member.firstName}${middle ? ` ${middle}.` : ""}`;
}

function shiftDate(shift: Shift) {
  const start = new Date(shift.startsAt);
  const end = shift.endsAt ? new Date(shift.endsAt) : null;
  return `${start.toLocaleString()}${end ? ` – ${end.toLocaleString()}` : ""}`;
}

function initialDraft(member: Member, shift: Shift): Draft {
  return {
    assigned: Boolean(member.assignment),
    status: member.assignment?.status ?? "ASSIGNED",
    role: member.assignment?.role ?? member.groupMembership?.role ?? shift.opportunity.defaultRole ?? "",
    outcome: member.assignment?.serviceRecord?.outcome ?? "",
    minutesServed: member.assignment?.serviceRecord?.minutesServed?.toString() ?? "",
    notes: member.assignment?.serviceRecord?.notes ?? ""
  };
}

export function VolunteerSchedulingManager() {
  const opportunityForm = useRef<HTMLFormElement>(null);
  const shiftForm = useRef<HTMLFormElement>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selected, setSelected] = useState<Shift | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [eventTeams, setEventTeams] = useState<Record<string, number>>({});

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ status: statusFilter, pageSize: "100" });
    void Promise.all([
      fetch("/api/membership/volunteer-groups", { signal: controller.signal }).then((response) => response.json()),
      fetch("/api/membership/volunteers/opportunities", { signal: controller.signal }).then((response) => response.json()),
      fetch(`/api/membership/volunteers/shifts?${params}`, { signal: controller.signal }).then((response) => response.json())
    ]).then(([groupValue, opportunityValue, shiftValue]) => {
      if (groupValue.error || opportunityValue.error || shiftValue.error) throw new Error(groupValue.error ?? opportunityValue.error ?? shiftValue.error);
      setGroups((groupValue.groups ?? []).map((group: { id: string; name: string; _count?: { members: number }; memberCount?: number }) => ({ id: group.id, name: group.name, memberCount: group._count?.members ?? group.memberCount ?? 0 })));
      setOpportunities(opportunityValue.opportunities ?? []);
      setShifts(shiftValue.shifts ?? []);
    }).catch((reason) => {
      if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, [reload, statusFilter]);

  useEffect(() => {
    if (!selected) { setMembers([]); setDrafts({}); return; }
    const controller = new AbortController();
    void fetch(`/api/membership/volunteers/shifts/${selected.id}/assignments`, { signal: controller.signal }).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load volunteers.");
      const rows: Member[] = value.members ?? [];
      setMembers(rows);
      setDrafts(Object.fromEntries(rows.map((member) => [member.id, initialDraft(member, selected)])));
      setDirty(new Set());
    }).catch((reason) => {
      if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, [selected]);

  async function createOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError(""); setMessage("");
    const body: Record<string, unknown> = Object.fromEntries(new FormData(event.currentTarget).entries());
    const selectedTeams = Object.entries(eventTeams).filter(([, volunteersNeeded]) => volunteersNeeded > 0);
    if (!selectedTeams.length) {
      setError("Select at least one volunteer team for this event.");
      setSubmitting(false);
      return;
    }
    body.groupId = selectedTeams[0][0];
    body.eventTeams = selectedTeams.map(([groupId, volunteersNeeded]) => ({ groupId, volunteersNeeded }));
    try {
      const response = await fetch("/api/membership/volunteers/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to create event.");
      opportunityForm.current?.reset();
      setMessage("Event created.");
      setReload((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create service opportunity.");
    } finally { setSubmitting(false); }
  }

  async function createShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError(""); setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    try {
      const startsAt = new Date(body.startsAt);
      const endsAt = body.endsAt ? new Date(body.endsAt) : null;
      if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new Error("Enter valid event dates.");
      const response = await fetch("/api/membership/volunteers/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() ?? null }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to schedule this event.");
      shiftForm.current?.reset();
      setEventTeams({});
      setSelected(value.shift);
      setMessage("Event scheduled.");
      setReload((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to schedule this event.");
    } finally { setSubmitting(false); }
  }

  function selectShift(shift: Shift) {
    if (dirty.size && !window.confirm("Discard unsaved volunteer changes?")) return;
    setSelected(shift); setMessage(""); setError("");
  }

  function updateDraft(id: string, update: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...update } }));
    setDirty((current) => new Set(current).add(id));
  }

  async function saveAssignments() {
    if (!selected || !dirty.size) return;
    setSubmitting(true); setError("");
    try {
      const assignments = Array.from(dirty).map((individualId) => ({ individualId, ...drafts[individualId] }));
      const response = await fetch(`/api/membership/volunteers/shifts/${selected.id}/assignments`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignments }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to save volunteer assignments.");
      setMessage(`${value.saved} volunteer row${value.saved === 1 ? "" : "s"} saved.`);
      setDirty(new Set());
      const refreshed = await fetch(`/api/membership/volunteers/shifts/${selected.id}/assignments`).then((result) => result.json());
      if (refreshed.members) {
        setMembers(refreshed.members);
        setDrafts(Object.fromEntries(refreshed.members.map((member: Member) => [member.id, initialDraft(member, selected)])));
      }
      setReload((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save volunteer assignments.");
    } finally { setSubmitting(false); }
  }

  async function updateShiftStatus(shift: Shift, status: string) {
    if (status === "CANCELLED" && !window.confirm("Cancel this event? Its volunteer history will remain available.")) return;
    const response = await fetch(`/api/membership/volunteers/shifts/${shift.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to update the event."); return; }
    setShifts((current) => current.map((item) => item.id === shift.id ? value.shift : item));
    if (selected?.id === shift.id) setSelected(value.shift);
    setMessage("Event status updated.");
  }

  async function deleteShift(shift: Shift) {
    if (!window.confirm("Delete this unassigned event date?")) return;
    const response = await fetch(`/api/membership/volunteers/shifts/${shift.id}`, { method: "DELETE" });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Unable to delete the event date."); return; }
    if (selected?.id === shift.id) setSelected(null);
    setMessage("Event date deleted.");
    setReload((current) => current + 1);
  }

  const readOnly = selected?.status === "CANCELLED";
  return <div className="mt-8 grid gap-6">
    {message && <Notification variant="success">{message}</Notification>}
    {error && <Notification variant="danger">{error}</Notification>}

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-2xl">Create an event</h2>
        <p className="mt-1 text-sm text-ink/60">Events use existing volunteer teams as their eligible rosters.</p>
        <form ref={opportunityForm} onSubmit={(event) => void createOpportunity(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="text-sm font-semibold">Volunteer teams</legend>
            <p className="text-xs text-ink/55">Choose each team needed for this event and set the number of volunteers.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {groups.map((group) => {
                const selected = eventTeams[group.id] !== undefined;
                return <label key={group.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${selected ? "border-coral bg-sand/30" : "border-ink/10"}`}>
                  <input type="checkbox" checked={selected} onChange={(event) => setEventTeams((current) => {
                    const next = { ...current };
                    if (event.target.checked) next[group.id] = current[group.id] ?? 1;
                    else delete next[group.id];
                    return next;
                  })} />
                  <span className="min-w-0 flex-1">{group.name} <span className="text-xs text-ink/50">({group.memberCount})</span></span>
                  <input type="number" min={1} max={1000} disabled={!selected} value={eventTeams[group.id] ?? 1} onChange={(event) => setEventTeams((current) => ({ ...current, [group.id]: Number(event.target.value) || 1 }))} className={`${inputClass} w-20`} aria-label={`Volunteers needed for ${group.name}`} />
                </label>;
              })}
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm font-semibold">Title<input required name="title" maxLength={120} className={inputClass} placeholder="Sunday usher team" /></label>
          <label className="grid gap-1 text-sm font-semibold">Default role<input name="defaultRole" maxLength={100} className={inputClass} placeholder="Usher" /></label>
          <label className="grid gap-1 text-sm font-semibold">Location<input name="location" maxLength={200} className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Description<textarea name="description" maxLength={2000} rows={2} className={inputClass} /></label>
          <div><Button disabled={submitting || !groups.length || !Object.keys(eventTeams).length}>{submitting ? "Creating…" : "Create event"}</Button></div>
        </form>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-2xl">Schedule an event date</h2>
        <form ref={shiftForm} onSubmit={(event) => void createShift(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Event<select required name="opportunityId" defaultValue="" className={inputClass}><option value="" disabled>Choose an active event</option>{opportunities.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.group.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-semibold">Starts<input required type="datetime-local" name="startsAt" className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold">Ends<input type="datetime-local" name="endsAt" className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold">Capacity<input type="number" min={1} max={1000} name="capacity" className={inputClass} placeholder="No limit" /></label>
          <label className="grid gap-1 text-sm font-semibold">Notes<input name="notes" maxLength={1000} className={inputClass} /></label>
          <div><Button disabled={submitting || !opportunities.some((item) => item.isActive)}>{submitting ? "Scheduling…" : "Schedule event"}</Button></div>
        </form>
      </section>
    </div>

    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Scheduled events</h2><p className="mt-1 text-sm text-ink/60">Select an event to assign volunteers or record participation.</p></div><label className="grid gap-1 text-xs font-semibold">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="all">All statuses</option>{SERVICE_SHIFT_STATUSES.map((status) => <option key={status} value={status}>{shiftStatusLabels[status]}</option>)}</select></label></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{shifts.map((shift) => <article key={shift.id} className={`rounded-xl border p-4 ${selected?.id === shift.id ? "border-coral bg-sand/30" : "border-ink/10"}`}>
        <button type="button" onClick={() => selectShift(shift)} className="focus-ring w-full rounded-lg text-left"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{shift.opportunity.title}</h3><span className="rounded-full bg-mist px-2 py-1 text-xs font-semibold">{shiftStatusLabels[shift.status]}</span></div><p className="mt-1 text-sm text-ink/65">{shiftDate(shift)}</p><p className="mt-1 text-sm text-ink/55">{shift.opportunity.group.name}{shift.opportunity.location ? ` · ${shift.opportunity.location}` : ""}</p><p className="mt-2 text-xs font-semibold text-ink/60">{shift._count.assignments} assigned{shift.capacity ? ` of ${shift.capacity}` : ""}</p></button>
        <div className="mt-3 flex items-center gap-2 border-t border-ink/10 pt-3"><label className="text-xs font-semibold">Status <select value={shift.status} onChange={(event) => void updateShiftStatus(shift, event.target.value)} className="focus-ring ml-1 rounded-lg border border-ink/15 bg-white px-2 py-1">{SERVICE_SHIFT_STATUSES.map((status) => <option key={status} value={status}>{shiftStatusLabels[status]}</option>)}</select></label><button type="button" onClick={() => void deleteShift(shift)} className="ml-auto text-xs font-semibold text-coral">Delete</button></div>
      </article>)}</div>
      {!shifts.length && <p className="mt-4 text-sm text-ink/55">No scheduled events match this filter.</p>}
    </section>

    {selected && <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Assign volunteers</p><h2 className="mt-1 font-serif text-2xl">{selected.opportunity.title}</h2><p className="mt-1 text-sm text-ink/60">{shiftDate(selected)} · {selected.opportunity.group.name}</p></div><Button type="button" disabled={readOnly || submitting || !dirty.size} onClick={() => void saveAssignments()}>{submitting ? "Saving…" : `Save changes${dirty.size ? ` (${dirty.size})` : ""}`}</Button></div>
      {readOnly && <Notification variant="warning" className="mt-4">This event is cancelled. Assignments and history are read-only.</Notification>}
      {selected.opportunity.eventTeams?.length ? <div className="mt-4 flex flex-wrap gap-2">{selected.opportunity.eventTeams.map((team) => <span key={team.groupId} className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">{team.group.name}: {team.volunteersNeeded} needed</span>)}</div> : null}
      <div className="mt-4 overflow-x-auto"><table className="min-w-[1100px] w-full text-left text-sm"><thead><tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/55"><th className="p-2">Assigned</th><th className="p-2">Volunteer</th><th className="p-2">Role</th><th className="p-2">Assignment</th><th className="p-2">Service result</th><th className="p-2">Minutes</th><th className="p-2">Notes</th></tr></thead>
        <tbody>{members.map((member) => { const draft = drafts[member.id] ?? initialDraft(member, selected); const disabled = readOnly; return <tr key={member.id} className={`border-b border-ink/5 ${dirty.has(member.id) ? "bg-amber-50" : ""}`}>
          <td className="p-2"><input type="checkbox" disabled={disabled} checked={draft.assigned} onChange={(event) => updateDraft(member.id, { assigned: event.target.checked, outcome: event.target.checked ? draft.outcome : "" })} aria-label={`Assign ${memberName(member)}`} /></td>
          <td className="p-2"><p className="font-semibold">{memberName(member)}</p><p className="text-xs text-ink/50">#{member.memberNumber}{member.groupMembership?.isLeader ? " · Group leader" : ""}{member.status === "REMOVED" ? " · Archived" : ""}</p></td>
          <td className="p-2"><input disabled={disabled || !draft.assigned} maxLength={100} value={draft.role} onChange={(event) => updateDraft(member.id, { role: event.target.value })} className={`${inputClass} w-40`} /></td>
          <td className="p-2"><select disabled={disabled || !draft.assigned} value={draft.status} onChange={(event) => updateDraft(member.id, { status: event.target.value })} className={inputClass}>{SERVICE_ASSIGNMENT_STATUSES.map((status) => <option key={status} value={status}>{assignmentStatusLabels[status]}</option>)}</select></td>
          <td className="p-2"><select disabled={disabled || !draft.assigned} value={draft.outcome} onChange={(event) => updateDraft(member.id, { outcome: event.target.value, minutesServed: event.target.value === "NO_SHOW" ? "0" : draft.minutesServed })} className={inputClass}><option value="" disabled={Boolean(member.assignment?.serviceRecord)}>Not recorded</option>{SERVICE_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{outcomeLabels[outcome]}</option>)}</select></td>
          <td className="p-2"><input disabled={disabled || !draft.assigned || !draft.outcome || draft.outcome === "NO_SHOW"} type="number" min={0} max={10080} value={draft.minutesServed} onChange={(event) => updateDraft(member.id, { minutesServed: event.target.value })} className={`${inputClass} w-24`} /></td>
          <td className="p-2"><input disabled={disabled || !draft.assigned || !draft.outcome} maxLength={500} value={draft.notes} onChange={(event) => updateDraft(member.id, { notes: event.target.value })} className={`${inputClass} min-w-48`} /></td>
        </tr>; })}</tbody>
      </table>{!members.length && <p className="py-6 text-center text-sm text-ink/55">This volunteer group has no members. Add members under Membership → Audiences first.</p>}</div>
    </section>}
  </div>;
}
