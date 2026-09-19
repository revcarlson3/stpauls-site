"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  status: string;
  category: string | null;
  location: string | null;
  readingsUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  published: boolean;
  recurrenceGroupId: string | null;
  attendanceEnabled: boolean;
  attendanceAudienceType: "VOLUNTEER" | "MANUAL" | "DYNAMIC" | null;
  attendanceAudienceId: string | null;
  timeZone: string | null;
};
type ViewMode = "month" | "week" | "agenda";
type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type AttendanceAudience = { id: string; name: string };
type EventVolunteerAssignment = {
  id: string;
  groupId: string;
  scheduledIndividualId: string | null;
  source: "ROTATION" | "OVERRIDE" | string;
  group: { name: string };
  individual: { id: string; firstName: string; lastName: string | null };
};
type EventVolunteerGroup = { id: string; name: string; members: { id: string; name: string }[] };
const defaultEventTypes = [
  ["WORSHIP", "Worship"],
  ["CLASS", "Class"],
  ["FELLOWSHIP", "Fellowship"],
  ["OUTREACH", "Outreach"],
  ["MEETING", "Meeting"],
  ["OTHER", "Other"]
] as const;
const defaultEventTypeValues = defaultEventTypes.map(([value]) => value);

const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function sameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function monthDays(month: Date) {
  const start = startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function rangeFor(view: ViewMode, date: Date) {
  if (view === "week") {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }
  return { start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 1) };
}

function inputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function inputTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function emptyEventForm(date: Date) {
  const value = inputDate(date);
  return { title: "", eventType: "OTHER", category: "", status: "SCHEDULED", startDate: value, endDate: value, startTime: "09:00", endTime: "10:00", allDay: false, details: "", location: "", readingsUrl: "", published: false, recurring: false, frequency: "WEEKLY" as RecurrenceFrequency, interval: 1, endMode: "DATE" as "DATE" | "OCCURRENCES", recurrenceEndDate: value, occurrences: 10 };
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold"><span>{label}</span><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`focus-ring relative h-6 w-11 rounded-full transition ${checked ? "bg-coral" : "bg-ink/20"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></button></label>;
}

export function EventsCalendar() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [view, setView] = useState<ViewMode>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteChoiceOpen, setDeleteChoiceOpen] = useState(false);
  const [saveChoiceOpen, setSaveChoiceOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "registrations" | "attendance" | "volunteers">("details");
  const [audiences, setAudiences] = useState<Record<"VOLUNTEER" | "MANUAL" | "DYNAMIC", AttendanceAudience[]>>({ VOLUNTEER: [], MANUAL: [], DYNAMIC: [] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>(defaultEventTypeValues);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>(["Church campus", "Sanctuary", "Fellowship hall", "Off-site"]);
  const [timeZone, setTimeZone] = useState("America/Chicago");
  const [form, setForm] = useState(() => ({ ...emptyEventForm(today), attendanceEnabled: false, attendanceAudienceType: "VOLUNTEER" as "VOLUNTEER" | "MANUAL" | "DYNAMIC", attendanceAudienceId: "" }));
  const [eventVolunteers, setEventVolunteers] = useState<EventVolunteerAssignment[]>([]);
  const [eventVolunteerGroups, setEventVolunteerGroups] = useState<EventVolunteerGroup[]>([]);
  const [adjustGroupId, setAdjustGroupId] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const loadEvents = useCallback(async () => {
    const { start, end } = rangeFor(view, cursor);
    const requestStart = new Date(start);
    requestStart.setDate(requestStart.getDate() - 7);
    const requestEnd = new Date(end);
    requestEnd.setDate(requestEnd.getDate() + 7);
    const response = await fetch(`/api/events?from=${encodeURIComponent(requestStart.toISOString())}&to=${encodeURIComponent(requestEnd.toISOString())}`);
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Unable to load events.");
    setEvents(value.events ?? []);
  }, [cursor, view]);

  useEffect(() => {
    void loadEvents().catch((reason: Error) => setError(reason.message));
  }, [loadEvents]);
  useEffect(() => {
    void fetch("/api/events/settings").then((response) => response.json()).then((value) => {
      if (value.settings) {
        setEventTypes(value.settings.eventTypes?.length ? value.settings.eventTypes : defaultEventTypeValues);
        setCategories(value.settings.categories ?? []);
        setLocations(value.settings.locations ?? []);
        setTimeZone(value.settings.timeZone || "America/Chicago");
      }
    });
  }, []);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = dateKey(new Date(event.startsAt));
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });
    return grouped;
  }, [events]);

  function move(amount: number) {
    setCursor((current) => {
      const next = new Date(current);
      if (view === "week") next.setDate(next.getDate() + amount * 7);
      else next.setMonth(next.getMonth() + amount);
      return next;
    });
  }

  function openAddPanel(day: Date) {
    setSelectedDate(day);
    setEditingEvent(null);
    setSaveChoiceOpen(false);
    setActiveTab("details");
    setEventVolunteers([]);
    setEventVolunteerGroups([]);
    setAdjustGroupId("");
    setForm({ ...emptyEventForm(day), attendanceEnabled: false, attendanceAudienceType: "VOLUNTEER", attendanceAudienceId: "" });
    setFormError("");
  }

  function openEditPanel(event: CalendarEvent) {
    const startsAt = new Date(event.startsAt);
    const endsAt = event.endsAt ? new Date(event.endsAt) : startsAt;
    setEditingEvent(event);
    setSaveChoiceOpen(false);
    setSelectedDate(startsAt);
    setActiveTab("details");
    setEventVolunteers([]);
    setForm({ title: event.title, eventType: event.eventType || "OTHER", category: event.category ?? "", status: event.status || "SCHEDULED", startDate: inputDate(startsAt), endDate: inputDate(endsAt), startTime: inputTime(startsAt), endTime: inputTime(endsAt), allDay: event.allDay, details: event.description ?? "", location: event.location ?? "", readingsUrl: event.readingsUrl ?? "", published: event.published, recurring: false, frequency: "WEEKLY", interval: 1, endMode: "DATE", recurrenceEndDate: inputDate(startsAt), occurrences: 10, attendanceEnabled: event.attendanceEnabled, attendanceAudienceType: event.attendanceAudienceType ?? "VOLUNTEER", attendanceAudienceId: event.attendanceAudienceId ?? "" });
    setFormError("");
    void Promise.all([
      fetch("/api/membership/volunteer-groups").then((response) => response.ok ? response.json() : { groups: [] }),
      fetch("/api/membership/manual-lists").then((response) => response.ok ? response.json() : { lists: [] }),
      fetch("/api/membership/dynamic-lists").then((response) => response.ok ? response.json() : { lists: [] }),
      fetch(`/api/events/${event.id}/rotation`).then((response) => response.ok ? response.json() : { assignments: [] }),
      fetch(`/api/events/${event.id}/volunteers`).then((response) => response.ok ? response.json() : { groups: [] })
    ]).then(([volunteer, manual, dynamic, rotation, linkedGroups]) => {
      setAudiences({ VOLUNTEER: volunteer.groups ?? [], MANUAL: manual.lists ?? [], DYNAMIC: dynamic.lists ?? [] });
      setEventVolunteers(rotation.assignments ?? []);
      setEventVolunteerGroups(linkedGroups.groups ?? []);
      setAdjustGroupId((linkedGroups.groups ?? [])[0]?.id ?? "");
    });
  }

  async function adjustEventVolunteer(groupId: string, individualId: string, action: "add" | "remove") {
    if (!editingEvent) return;
    setAdjusting(true);
    const response = await fetch(`/api/events/${editingEvent.id}/rotation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, individualId, action }) });
    const value = await response.json();
    if (!response.ok) {
      setFormError(value.error ?? "Unable to adjust event volunteers.");
      setAdjusting(false);
      return;
    }
    const rotation = await fetch(`/api/events/${editingEvent.id}/rotation`).then((result) => result.ok ? result.json() : { assignments: [] });
    setEventVolunteers(rotation.assignments ?? []);
    setAdjusting(false);
  }

  async function saveEvent(applyToSeries = false) {
    setSaving(true);
    setFormError("");
    const startsAt = form.allDay ? `${form.startDate}T00:00:00` : `${form.startDate}T${form.startTime}:00`;
    const endsAt = form.allDay ? `${form.endDate}T23:59:59` : `${form.endDate}T${form.endTime}:00`;
    const response = await fetch("/api/events", { method: editingEvent ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingEvent?.id, applyToSeries, title: form.title, eventType: form.eventType, category: form.category, status: form.status, timeZone, startsAt, endsAt, allDay: form.allDay, description: form.details, location: form.location, readingsUrl: form.readingsUrl, published: form.published, attendanceEnabled: form.attendanceEnabled, attendanceAudienceType: form.attendanceAudienceType, attendanceAudienceId: form.attendanceAudienceId || null, recurrence: { enabled: form.recurring, frequency: form.frequency, interval: form.interval, endMode: form.endMode, endDate: form.recurrenceEndDate, occurrences: form.occurrences } }) });
    const value = await response.json();
    if (!response.ok) {
      setFormError(value.error ?? "Unable to create event.");
      setSaving(false);
      return;
    }

    setSaveChoiceOpen(false);
    setSelectedDate(null);
    setEditingEvent(null);
    setForm({ ...emptyEventForm(selectedDate ?? today), attendanceEnabled: false, attendanceAudienceType: "VOLUNTEER", attendanceAudienceId: "" });
    setSaving(false);
    await loadEvents();
  }

  function handleEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingEvent?.recurrenceGroupId) {
      setSaveChoiceOpen(true);
      return;
    }
    void saveEvent();
  }

  async function deleteEvent(series: boolean) {
    if (!editingEvent) return;
    setDeleting(true);
    const response = await fetch(`/api/events?id=${encodeURIComponent(editingEvent.id)}&series=${series}`, { method: "DELETE" });
    const value = await response.json();
    if (!response.ok) {
      setFormError(value.error ?? "Unable to delete event.");
      setDeleting(false);
      setDeleteChoiceOpen(false);
      return;
    }
    setDeleting(false);
    setDeleteChoiceOpen(false);
    setSelectedDate(null);
    setEditingEvent(null);
    setForm({ ...emptyEventForm(today), attendanceEnabled: false, attendanceAudienceType: "VOLUNTEER", attendanceAudienceId: "" });
    await loadEvents();
  }

  const days = monthDays(cursor);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = startOfWeek(cursor);
    day.setDate(day.getDate() + index);
    return day;
  });
  const agendaEvents = [...events].sort((first, second) => first.startsAt.localeCompare(second.startsAt));

  return <section className={`relative mt-10 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-6 ${selectedDate ? "xl:grid xl:grid-cols-[minmax(0,1fr)_28rem] xl:gap-6" : ""}`}>
    <div className={selectedDate ? "xl:min-w-0" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold hover:border-coral" aria-label="Previous period">←</button>
          <button type="button" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold hover:border-coral">Today</button>
          <button type="button" onClick={() => move(1)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold hover:border-coral" aria-label="Next period">→</button>
          <h2 className="ml-2 font-serif text-2xl">{view === "month" ? monthFormatter.format(cursor) : view === "week" ? `Week of ${cursor.toLocaleDateString()}` : "Agenda"}</h2>
        </div>
        <div className="flex rounded-lg border border-ink/15 p-1" aria-label="Calendar view">{(["month", "week", "agenda"] as ViewMode[]).map((option) => <button key={option} type="button" onClick={() => setView(option)} className={`focus-ring rounded-md px-3 py-2 text-sm font-semibold capitalize ${view === option ? "bg-ink text-white" : "hover:bg-mist"}`}>{option}</button>)}</div>
      </div>
      {error && <p role="alert" className="mt-5 text-sm font-semibold text-coral">{error}</p>}
      {view === "month" && <div className="mt-6 overflow-hidden rounded-xl border border-ink/10">
        <div className="grid grid-cols-7 border-b border-ink/10 bg-mist/50">{days.slice(0, 7).map((day) => <div key={day.getDay()} className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-ink/55">{dayFormatter.format(day)}</div>)}</div>
        <div className="grid grid-cols-7">{days.map((day) => {
          const dayEvents = eventsByDay.get(dateKey(day)) ?? [];
          return <div key={day.toISOString()} role="button" tabIndex={0} onClick={() => openAddPanel(day)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openAddPanel(day); }} className={`min-h-28 cursor-pointer border-b border-r border-ink/10 p-2 ${day.getMonth() !== cursor.getMonth() ? "bg-ink/[.025] text-ink/35" : ""} ${sameDay(day, today) ? "bg-coral/[.08]" : ""}`}>
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${sameDay(day, today) ? "bg-coral font-bold text-white" : "font-semibold"}`}>{day.getDate()}</span>
            <div className="mt-1 grid gap-1">{dayEvents.slice(0, 3).map((event) => <button type="button" key={event.id} onClick={(click) => { click.stopPropagation(); openEditPanel(event); }} className={`truncate rounded px-2 py-1 text-left text-xs font-semibold ${event.status === "CANCELLED" ? "bg-ink/10 text-ink/45 line-through" : "bg-teal/10 text-teal-900"}`} title={`Edit ${event.title}`}>{event.title}</button>)}{dayEvents.length > 3 && <span className="px-2 text-xs text-ink/55">+{dayEvents.length - 3} more</span>}</div>
          </div>;
        })}</div>
      </div>}
      {view === "week" && <div className="mt-6 grid grid-cols-7 overflow-hidden rounded-xl border border-ink/10">{weekDays.map((day) => <div key={day.toISOString()} role="button" tabIndex={0} onClick={() => openAddPanel(day)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openAddPanel(day); }} className="min-h-72 cursor-pointer border-r border-ink/10 last:border-r-0"><div className={`border-b border-ink/10 p-3 text-center ${sameDay(day, today) ? "bg-coral/[.08]" : "bg-mist/50"}`}><p className="text-xs font-semibold uppercase text-ink/55">{dayFormatter.format(day)}</p><p className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${sameDay(day, today) ? "bg-coral text-white" : ""}`}>{day.getDate()}</p></div><div className="grid gap-2 p-2">{(eventsByDay.get(dateKey(day)) ?? []).map((event) => <button type="button" key={event.id} onClick={(click) => { click.stopPropagation(); openEditPanel(event); }} className="rounded-lg bg-teal/10 p-2 text-left text-xs" title={`Edit ${event.title}`}><p className="font-semibold">{event.allDay ? "All day" : timeFormatter.format(new Date(event.startsAt))}</p><p className="mt-1 font-semibold">{event.title}</p></button>)}</div></div>)}</div>}
      {view === "agenda" && <div className="mt-6 grid gap-3">{agendaEvents.length ? agendaEvents.map((event) => <button type="button" key={event.id} onClick={() => openEditPanel(event)} className="rounded-xl border border-ink/10 p-4 text-left hover:border-coral"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm font-semibold text-coral">{new Date(event.startsAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><h3 className="mt-1 font-serif text-xl">{event.title}</h3></div><p className="text-sm font-semibold text-ink/60">{event.allDay ? "All day" : `${timeFormatter.format(new Date(event.startsAt))}${event.endsAt ? ` – ${timeFormatter.format(new Date(event.endsAt))}` : ""}`}</p></div>{(event.location || event.description) && <p className="mt-2 text-sm text-ink/60">{[event.location, event.description].filter(Boolean).join(" · ")}</p>}</button>) : <p className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">No events in this period.</p>}</div>}
    </div>
    {selectedDate && <aside className="mt-6 border-t border-ink/10 pt-6 xl:mt-0 xl:border-l xl:border-t-0 xl:pl-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-coral">{editingEvent ? "Edit event" : "New event"}</p><h2 className="mt-1 font-serif text-2xl">{editingEvent ? "Edit Event" : "Add Event"}</h2><p className="mt-1 text-sm text-ink/60">For {selectedDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p></div><button type="button" onClick={() => { setSelectedDate(null); setEditingEvent(null); setSaveChoiceOpen(false); }} className="focus-ring rounded-lg px-2 py-1 text-xl text-ink/55 hover:bg-mist" aria-label="Close event panel">×</button></div>
      {editingEvent && <div className="mt-6 grid grid-cols-4 rounded-lg border border-ink/15 p-1" role="group" aria-label="Event sections">{(["details", "registrations", "attendance", "volunteers"] as const).map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`focus-ring rounded-md px-2 py-2 text-xs font-semibold capitalize ${activeTab === tab ? "bg-ink text-white" : "hover:bg-mist"}`}>{tab}</button>)}</div>}
      <form onSubmit={handleEventSubmit} className="mt-6 grid gap-4">
        <div className={activeTab === "details" ? "contents" : "hidden"}>
        <label className="grid gap-1 text-sm font-semibold">Event name<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Event type<select value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal">{eventTypes.map((value) => <option key={value} value={value}>{defaultEventTypes.find(([option]) => option === value)?.[1] ?? value.replace(/_/g, " ")}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Event category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="">No category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        {editingEvent && <label className="grid gap-1 text-sm font-semibold">Event status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="SCHEDULED">Scheduled</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label>}
        <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-semibold">Event date<input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">End date<input required type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div>
        <Toggle checked={form.allDay} onChange={(value) => setForm({ ...form, allDay: value })} label="All day event" />
        {!form.allDay && <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-semibold">Start time<input required type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">End time<input required type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div>}
        <label className="grid gap-1 text-sm font-semibold">Event details<textarea rows={4} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Event location<select value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="">Select a location</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Readings URL <span className="font-normal text-ink/55">(optional)</span><input type="url" value={form.readingsUrl} onChange={(event) => setForm({ ...form, readingsUrl: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" placeholder="https://example.org/readings/this-week" /><span className="text-xs font-normal text-ink/55">Used by the {"{{eventReadingsUrl}}"} smart tag in volunteer notifications.</span></label>
        {!editingEvent && <Toggle checked={form.recurring} onChange={(value) => setForm({ ...form, recurring: value })} label="Recurring event" />}
        {!editingEvent && form.recurring && <div className="grid gap-4 rounded-xl bg-mist/50 p-4">
          <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-semibold">Repeats<select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as RecurrenceFrequency })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label><label className="grid gap-1 text-sm font-semibold">Every<input min={1} max={52} type="number" value={form.interval} onChange={(event) => setForm({ ...form, interval: Number(event.target.value) })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label></div>
          <label className="grid gap-1 text-sm font-semibold">Ends<select value={form.endMode} onChange={(event) => setForm({ ...form, endMode: event.target.value as "DATE" | "OCCURRENCES" })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="DATE">On a date</option><option value="OCCURRENCES">After a number of occurrences</option></select></label>
          {form.endMode === "DATE" ? <label className="grid gap-1 text-sm font-semibold">Recurrence end date<input required type="date" min={form.startDate} value={form.recurrenceEndDate} onChange={(event) => setForm({ ...form, recurrenceEndDate: event.target.value })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label> : <label className="grid gap-1 text-sm font-semibold">Occurrences<input required min={2} max={365} type="number" value={form.occurrences} onChange={(event) => setForm({ ...form, occurrences: Number(event.target.value) })} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 font-normal" /></label>}
        </div>}
        <Toggle checked={form.published} onChange={(value) => setForm({ ...form, published: value })} label="Publish event" />
        {formError && <p role="alert" className="text-sm font-semibold text-coral">{formError}</p>}
        <button disabled={saving} type="submit" className="focus-ring rounded-lg bg-coral px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : editingEvent ? "Save changes" : "Add event"}</button>
        {editingEvent && <button disabled={saving || deleting} type="button" onClick={() => editingEvent.recurrenceGroupId ? setDeleteChoiceOpen(true) : void deleteEvent(false)} className="focus-ring rounded-lg border border-coral px-4 py-3 text-sm font-semibold text-coral disabled:opacity-60">{deleting ? "Deleting..." : "Delete event"}</button>}
        </div>
        {editingEvent && activeTab === "registrations" && <div className="rounded-xl border border-dashed border-ink/20 p-5 text-sm text-ink/60">Event registration options will be available here in a future update.</div>}
        {editingEvent && activeTab === "attendance" && <div className="grid gap-4 rounded-xl border border-ink/10 p-4"><Toggle checked={form.attendanceEnabled} onChange={(value) => setForm({ ...form, attendanceEnabled: value })} label="Enable attendance" />{form.attendanceEnabled && <><label className="grid gap-1 text-sm font-semibold">Attendance audience<select required value={form.attendanceAudienceType} onChange={(event) => setForm({ ...form, attendanceAudienceType: event.target.value as "VOLUNTEER" | "MANUAL" | "DYNAMIC", attendanceAudienceId: "" })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="VOLUNTEER">Volunteer audience</option><option value="MANUAL">Manual audience</option><option value="DYNAMIC">Dynamic audience</option></select></label><label className="grid gap-1 text-sm font-semibold">Select audience<select required value={form.attendanceAudienceId} onChange={(event) => setForm({ ...form, attendanceAudienceId: event.target.value })} className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal"><option value="">Select an audience</option>{audiences[form.attendanceAudienceType].map((audience) => <option key={audience.id} value={audience.id}>{audience.name}</option>)}</select></label></>}<button disabled={saving} type="submit" className="focus-ring rounded-lg bg-coral px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save attendance settings"}</button></div>}
        {editingEvent && activeTab === "volunteers" && <div className="grid gap-4 rounded-xl border border-ink/10 p-4"><div><h3 className="font-serif text-xl">Scheduled volunteers</h3><p className="mt-1 text-sm text-ink/60">Adjust this event only. Changes here do not change the rotation order or future events.</p></div>{eventVolunteerGroups.length ? <div className="grid gap-4">{eventVolunteerGroups.map((group) => { const assignments = eventVolunteers.filter((assignment) => assignment.groupId === group.id); const assignedIds = new Set(assignments.map((assignment) => assignment.individual.id)); return <div key={group.id} className="rounded-xl border border-ink/10 p-3"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">{group.name}</h4><span className="text-xs text-ink/55">{assignments.length} assigned</span></div><ul className="mt-2 grid gap-2">{assignments.map((assignment) => { const replaced = assignment.source === "OVERRIDE"; return <li key={assignment.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${replaced ? "bg-coral/15 ring-1 ring-coral/25" : "bg-mist/50"}`}><span>{assignment.individual.lastName ? `${assignment.individual.lastName}, ${assignment.individual.firstName}` : assignment.individual.firstName}{replaced && <span className="ml-2 rounded-full bg-coral px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{assignment.scheduledIndividualId ? "Replaced" : "Manual"}</span>}</span><button type="button" disabled={adjusting} onClick={() => void adjustEventVolunteer(group.id, assignment.individual.id, "remove")} className="text-xs font-semibold text-coral">Remove</button></li>; })}</ul><div className="mt-3 border-t border-ink/10 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Add volunteer for this event</p><div className="mt-2 flex flex-wrap gap-2">{group.members.filter((member) => !assignedIds.has(member.id)).map((member) => <button key={member.id} type="button" disabled={adjusting} onClick={() => void adjustEventVolunteer(group.id, member.id, "add")} className="rounded-full border border-coral/40 px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral/10 disabled:opacity-50">{member.name}</button>)}{!group.members.some((member) => !assignedIds.has(member.id)) && <span className="text-xs text-ink/55">All group members are assigned.</span>}</div></div></div>; })}</div> : <p className="rounded-lg border border-dashed border-ink/20 p-4 text-sm text-ink/60">No volunteer groups are linked to this event.</p>}</div>}
      </form>
    </aside>}
    {deleteChoiceOpen && editingEvent && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 p-5" role="dialog" aria-modal="true" aria-labelledby="delete-event-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="delete-event-title" className="font-serif text-2xl">Delete recurring event</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">Would you like to delete only this occurrence or every event in the series?</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" disabled={deleting} onClick={() => void deleteEvent(false)} className="focus-ring rounded-lg border border-ink/20 px-4 py-3 text-sm font-semibold hover:border-coral">This event only</button><button type="button" disabled={deleting} onClick={() => void deleteEvent(true)} className="focus-ring rounded-lg bg-coral px-4 py-3 text-sm font-semibold text-white">Whole series</button></div>
        <button type="button" onClick={() => setDeleteChoiceOpen(false)} className="focus-ring mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-ink/60 hover:bg-mist">Cancel</button>
      </div>
    </div>}
    {saveChoiceOpen && editingEvent && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 p-5" role="dialog" aria-modal="true" aria-labelledby="save-event-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="save-event-title" className="font-serif text-2xl">Update recurring event</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">Would you like to apply these changes only to this occurrence or to every event in the series?</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" disabled={saving} onClick={() => void saveEvent(false)} className="focus-ring rounded-lg border border-ink/20 px-4 py-3 text-sm font-semibold hover:border-coral">This event only</button><button type="button" disabled={saving} onClick={() => void saveEvent(true)} className="focus-ring rounded-lg bg-coral px-4 py-3 text-sm font-semibold text-white">Whole series</button></div>
        <button type="button" onClick={() => setSaveChoiceOpen(false)} className="focus-ring mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-ink/60 hover:bg-mist">Cancel</button>
      </div>
    </div>}
  </section>;
}
