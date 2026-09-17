"use client";

import { useEffect, useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type DashboardData = {
  upcoming: Array<{ id: string; title: string; startsAt: string; endsAt: string | null; location: string | null; allDay: boolean; attendanceEnabled: boolean; volunteerGroups: string[] }>;
  attendance: { windowDays: number; total: number; counts: Array<{ label: string; count: number }> };
  volunteer: { eventCount: number; assignmentCount: number; events: Array<{ id: string; title: string; startsAt: string; volunteerGroups: string[] }> };
  reporting: { reportCount: number; automations: Array<{ id: string; name: string; nextRunAt: string | null; lastRunAt: string | null; failureCount: number }> };
};

const defaultBlocks = ["upcoming", "attendance", "events-volunteer", "reporting"] as const;
type BlockId = typeof defaultBlocks[number];
type Width = "quarter" | "half" | "full";
const labels: Record<BlockId, string> = { upcoming: "Upcoming events", attendance: "Attendance activity", "events-volunteer": "Volunteer scheduling", reporting: "Events reporting" };
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
type SharedProps = { id: BlockId; data: DashboardData };

function Metric({ value, label }: { value: number | string; label: string }) {
  return <div className="rounded-xl bg-mist/35 p-3"><p className="text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p><p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p></div>;
}

function EventPanel({ id, data }: SharedProps) {
  return <article className="rounded-2xl border border-ink/10 bg-white p-5 pl-14 shadow-sm">{id === "upcoming" && <><div className="flex items-start justify-between gap-3"><div><h3 className="font-serif text-2xl">{labels[id]}</h3><p className="mt-1 text-sm text-ink/60">Scheduled in the next 30 days.</p></div><a href="/admin/events" className="text-sm font-semibold text-coral hover:underline">Open calendar</a></div>{data.upcoming.length ? <ul className="mt-4 divide-y divide-ink/10">{data.upcoming.map((event) => <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><a href="/admin/events" className="font-semibold text-coral hover:underline">{event.title}</a><p className="text-xs text-ink/55">{dateLabel(event.startsAt)}{event.location ? ` · ${event.location}` : ""}</p></div><div className="flex gap-1 text-[10px] font-bold uppercase tracking-wide text-ink/50">{event.attendanceEnabled && <span className="rounded-full bg-mist px-2 py-1">Attendance</span>}{event.volunteerGroups.length > 0 && <span className="rounded-full bg-mist px-2 py-1">Volunteers</span>}</div></li>)}</ul> : <p className="mt-4 rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No upcoming events in this window.</p>}</>}
      {id === "attendance" && <><div className="flex items-start justify-between gap-3"><div><h3 className="font-serif text-2xl">{labels[id]}</h3><p className="mt-1 text-sm text-ink/60">Recorded during the last 30 days.</p></div><a href="/admin/events/attendance" className="text-sm font-semibold text-coral hover:underline">Manage attendance</a></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric value={data.attendance.total} label="records" />{data.attendance.counts.slice(0, 3).map((item) => <Metric key={item.label} value={item.count} label={item.label.toLowerCase()} />)}</div>{!data.attendance.total && <p className="mt-4 rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No attendance has been recorded recently.</p>}</>}
      {id === "events-volunteer" && <><div className="flex items-start justify-between gap-3"><div><h3 className="font-serif text-2xl">{labels[id]}</h3><p className="mt-1 text-sm text-ink/60">Volunteer-linked events in the next 30 days.</p></div><a href="/admin/events/volunteer-scheduling" className="text-sm font-semibold text-coral hover:underline">Open scheduling</a></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric value={data.volunteer.eventCount} label="events" /><Metric value={data.volunteer.assignmentCount} label="assignments" /></div>{data.volunteer.events.length ? <ul className="mt-4 divide-y divide-ink/10">{data.volunteer.events.map((event) => <li key={event.id} className="py-3"><p className="font-semibold">{event.title}</p><p className="text-xs text-ink/55">{dateLabel(event.startsAt)} · {event.volunteerGroups.join(", ")}</p></li>)}</ul> : <p className="mt-4 rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No volunteer-linked events are scheduled.</p>}</>}
      {id === "reporting" && <><div className="flex items-start justify-between gap-3"><div><h3 className="font-serif text-2xl">{labels[id]}</h3><p className="mt-1 text-sm text-ink/60">{data.reporting.reportCount} saved Events report{data.reporting.reportCount === 1 ? "" : "s"}.</p></div><a href="/admin/events/reports" className="text-sm font-semibold text-coral hover:underline">Open reports</a></div>{data.reporting.automations.length ? <ul className="mt-4 divide-y divide-ink/10">{data.reporting.automations.map((automation) => <li key={automation.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{automation.name}</p><p className="text-xs text-ink/55">{automation.nextRunAt ? `Next ${dateLabel(automation.nextRunAt)}` : "No next run"}{automation.failureCount ? ` · ${automation.failureCount} failure${automation.failureCount === 1 ? "" : "s"}` : ""}</p></div><span className={`text-xs font-semibold ${automation.failureCount ? "text-coral" : "text-ink/50"}`}>{automation.failureCount ? "Needs attention" : "Healthy"}</span></li>)}</ul> : <p className="mt-4 rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No enabled Events report automations.</p>}</>}
    </article>;
}

function SortableEventPanel({ id, data, width, sortOrder, dragLocked }: SharedProps & { width: Width; sortOrder: number; dragLocked: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: dragLocked });
  return <div ref={setNodeRef} style={{ order: sortOrder, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} {...attributes} className={`relative ${width === "quarter" ? "lg:col-span-1" : width === "half" ? "lg:col-span-2" : "lg:col-span-4"} ${isDragging ? "scale-[1.02] rotate-1 opacity-70" : ""}`}>{!dragLocked && <button type="button" {...listeners} className="focus-ring absolute left-5 top-5 z-10 touch-none cursor-grab rounded-md bg-mist px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink/50" aria-label={`Drag ${labels[id]}`}>☷</button>}<EventPanel id={id} data={data} /></div>;
}

export function EventsDashboard({ sharedOrder, dragLocked = false }: { sharedOrder?: string[]; dragLocked?: boolean } = {}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [order, setOrder] = useState<BlockId[]>([...defaultBlocks]);
  const [visible, setVisible] = useState<Record<BlockId, boolean>>({ upcoming: true, attendance: true, "events-volunteer": true, reporting: true });
  const [widths, setWidths] = useState<Record<BlockId, Width>>({ upcoming: "half", attendance: "half", "events-volunteer": "half", reporting: "half" });
  const [error, setError] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("events-dashboard-layout") ?? "null") as { order?: BlockId[]; visible?: Record<BlockId, boolean>; widths?: Record<BlockId, Width> } | null;
      if (saved?.order?.length === defaultBlocks.length && saved.order.every((id) => defaultBlocks.includes(id))) setOrder(saved.order);
      if (saved?.visible) setVisible((current) => ({ ...current, ...saved.visible }));
      if (saved?.widths) setWidths((current) => ({ ...current, ...saved.widths }));
    } catch { localStorage.removeItem("events-dashboard-layout"); }
    void fetch("/api/account", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((account) => {
      const canManage = Array.isArray(account?.permissions) && account.permissions.includes("MANAGE_EVENTS");
      setAllowed(canManage);
      if (!canManage) return null;
      return fetch("/api/events/dashboard", { cache: "no-store" });
    }).then(async (response) => {
      if (!response) return null;
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load dashboard.");
      setData(value);
    }).catch((reason: Error) => setError(reason.message));
    const refreshLayout = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("events-dashboard-layout") ?? "null") as { order?: BlockId[]; visible?: Record<BlockId, boolean>; widths?: Record<BlockId, Width> } | null;
        if (saved?.visible) setVisible((current) => ({ ...current, ...saved.visible }));
        if (saved?.widths) setWidths((current) => ({ ...current, ...saved.widths }));
      } catch { /* Use the current layout when preferences are malformed. */ }
    };
    window.addEventListener("events-dashboard-layout-changed", refreshLayout);
    return () => window.removeEventListener("events-dashboard-layout-changed", refreshLayout);
  }, []);
  const save = (nextOrder: BlockId[], nextVisible: Record<BlockId, boolean>, nextWidths = widths) => {
    setOrder(nextOrder); setVisible(nextVisible); setWidths(nextWidths); localStorage.setItem("events-dashboard-layout", JSON.stringify({ order: nextOrder, visible: nextVisible, widths: nextWidths }));
  };
  const visibleOrder = useMemo(() => order.filter((id) => visible[id]), [order, visible]);
  if (allowed === false) return null;
  if (error) return <section className="mt-10 rounded-xl border border-coral/25 bg-coral/5 p-5" role="alert"><p className="font-semibold text-coral">Events dashboard unavailable</p><p className="mt-1 text-sm text-ink/65">{error}</p></section>;
  if (!data) return <section className="mt-10 grid gap-6 lg:grid-cols-2" role="status" aria-label="Loading Events and Scheduling dashboard">{defaultBlocks.map((id) => <div key={id} className="h-48 animate-pulse rounded-2xl border border-ink/10 bg-white p-5" />)}</section>;
  const sharedVisibleOrder = sharedOrder?.filter((id) => defaultBlocks.includes(id as BlockId) && visible[id as BlockId]) ?? visibleOrder;
  if (sharedOrder) return <div className="contents">{sharedVisibleOrder.map((id) => <SortableEventPanel key={id} id={id as BlockId} data={data} width={widths[id as BlockId]} sortOrder={sharedOrder.indexOf(id)} dragLocked={dragLocked} />)}</div>;
  return <section className="mt-12" aria-labelledby="events-dashboard-heading">
    <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Events and scheduling</p><h2 id="events-dashboard-heading" className="mt-2 font-serif text-3xl">Operations dashboard</h2><p className="mt-1 text-sm text-ink/60">The next 30 days of events, attendance, volunteer coverage, and reporting.</p></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">{visibleOrder.map((id) => <EventPanel key={id} id={id} data={data} />)}</div>
  </section>;
}
