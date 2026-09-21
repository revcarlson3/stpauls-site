"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  category: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  registrationUrl?: string | null;
};
type ViewMode = "month" | "week" | "agenda";

const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
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
function eventTime(event: PublicEvent) {
  if (event.allDay) return "All day";
  const start = timeFormatter.format(new Date(event.startsAt));
  return event.endsAt ? `${start} – ${timeFormatter.format(new Date(event.endsAt))}` : start;
}
function eventDescription(value: string | null) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "Event details will be available soon.";
}

function EventTile({ event, compact = false }: { event: PublicEvent; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={(focusEvent) => { if (!focusEvent.currentTarget.contains(focusEvent.relatedTarget)) setOpen(false); }}>
    <button type="button" aria-expanded={open} className={`focus-ring w-full truncate rounded-lg bg-teal/10 px-2 py-1 text-left text-xs font-semibold text-teal-950 hover:bg-teal/20 ${compact ? "py-1" : "p-2"}`}>
      {!compact && <span className="block text-[11px] font-medium text-teal-900/70">{eventTime(event)}</span>}
      <span className="block truncate">{event.title}</span>
    </button>
    {open && <div role="tooltip" className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-ink/10 bg-white p-4 text-left shadow-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-coral">{event.eventType.replace(/_/g, " ")}</p>
      <h3 className="mt-1 font-serif text-xl leading-tight text-ink">{event.title}</h3>
      <p className="mt-2 text-xs font-semibold text-ink/60">{new Date(event.startsAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · {eventTime(event)}</p>
      {event.location && <p className="mt-2 text-sm text-ink/70">{event.location}</p>}
      <p className="mt-2 text-sm leading-5 text-ink/65">{eventDescription(event.description)}</p>
      {event.category && <p className="mt-3 text-xs font-semibold text-ink/50">{event.category}</p>}
      {event.registrationUrl && <Link href={event.registrationUrl} className="focus-ring mt-4 inline-flex rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Register</Link>}
    </div>}
  </div>;
}

export function PublicEventCalendar() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [view, setView] = useState<ViewMode>("month");
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const { start, end } = rangeFor(view, cursor);
    const requestStart = new Date(start);
    requestStart.setDate(requestStart.getDate() - 7);
    const requestEnd = new Date(end);
    requestEnd.setDate(requestEnd.getDate() + 7);
    void fetch(`/api/public/events?from=${encodeURIComponent(requestStart.toISOString())}&to=${encodeURIComponent(requestEnd.toISOString())}`)
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? "Unable to load the events calendar.");
        setEvents(value.events ?? []);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [cursor, view]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, PublicEvent[]>();
    events.forEach((event) => {
      const key = dateKey(new Date(event.startsAt));
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });
    return grouped;
  }, [events]);
  const days = monthDays(cursor);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = startOfWeek(cursor);
    day.setDate(day.getDate() + index);
    return day;
  });
  const agendaEvents = [...events].sort((first, second) => first.startsAt.localeCompare(second.startsAt));
  function move(amount: number) {
    setCursor((current) => {
      const next = new Date(current);
      if (view === "week") next.setDate(next.getDate() + amount * 7);
      else next.setMonth(next.getMonth() + amount);
      return next;
    });
  }

  return <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2"><button type="button" onClick={() => move(-1)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold hover:border-coral" aria-label="Previous period">←</button><button type="button" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold hover:border-coral">Today</button><button type="button" onClick={() => move(1)} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold hover:border-coral" aria-label="Next period">→</button><h2 className="ml-2 font-serif text-2xl">{view === "month" ? monthFormatter.format(cursor) : view === "week" ? `Week of ${cursor.toLocaleDateString()}` : "Agenda"}</h2></div>
      <div className="flex rounded-lg border border-ink/15 p-1" aria-label="Calendar view">{(["month", "week", "agenda"] as ViewMode[]).map((option) => <button key={option} type="button" onClick={() => setView(option)} className={`focus-ring rounded-md px-3 py-2 text-sm font-semibold capitalize ${view === option ? "bg-ink text-white" : "hover:bg-mist"}`}>{option}</button>)}</div>
    </div>
    {error && <p role="alert" className="mt-5 text-sm font-semibold text-coral">{error}</p>}
    {view === "month" && <div className="mt-6 overflow-visible rounded-xl border border-ink/10"><div className="grid grid-cols-7 border-b border-ink/10 bg-mist/50">{days.slice(0, 7).map((day) => <div key={day.getDay()} className="p-2 text-center text-xs font-semibold uppercase tracking-wider text-ink/55">{dayFormatter.format(day)}</div>)}</div><div className="grid grid-cols-7">{days.map((day) => <div key={day.toISOString()} className={`min-h-28 border-b border-r border-ink/10 p-2 ${day.getMonth() !== cursor.getMonth() ? "bg-ink/[.025] text-ink/35" : ""}`}><span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold">{day.getDate()}</span><div className="mt-1 grid gap-1">{(eventsByDay.get(dateKey(day)) ?? []).slice(0, 3).map((event) => <EventTile key={event.id} event={event} compact />)}</div></div>)}</div></div>}
    {view === "week" && <div className="mt-6 grid grid-cols-7 overflow-visible rounded-xl border border-ink/10">{weekDays.map((day) => <div key={day.toISOString()} className="min-h-72 border-r border-ink/10 p-2 last:border-r-0"><p className="border-b border-ink/10 p-2 text-center text-xs font-semibold uppercase text-ink/55">{dayFormatter.format(day)} {day.getDate()}</p><div className="mt-2 grid gap-2">{(eventsByDay.get(dateKey(day)) ?? []).map((event) => <EventTile key={event.id} event={event} />)}</div></div>)}</div>}
    {view === "agenda" && <div className="mt-6 grid gap-3">{agendaEvents.length ? agendaEvents.map((event) => <div key={event.id} className="relative rounded-xl border border-ink/10 p-4 hover:border-coral"><EventTile event={event} /></div>) : <p className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">No events in this period.</p>}</div>}
  </div>;
}
