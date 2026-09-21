"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReportSummaryChart } from "@/components/report-summary-chart";
import {
  DEFAULT_MEMBERSHIP_DASHBOARD_LAYOUT,
  MEMBERSHIP_DASHBOARD_BLOCK_IDS,
  normalizeDashboardLayout,
  type MembershipDashboardBlockId,
  type MembershipDashboardBlockWidth,
  type MembershipDashboardLayout
} from "@/lib/membership-dashboard-shared";

type BlockId = MembershipDashboardBlockId;
type Width = MembershipDashboardBlockWidth;
type AnnualItem = { id: string; name: string; date: string; years?: number };
type Comparison = { current: number; prior: number; change: number; changePercent: number | null };
type DashboardData = {
  generatedAt: string;
  layout: MembershipDashboardLayout;
  layoutSaved: boolean;
  dateWindowDays: number;
  birthdays: AnnualItem[];
  anniversaries: Array<AnnualItem & { familyId: string; years: number }>;
  incompleteProfiles: { count: number; completionPercent: number; members: Array<{ id: string; name: string; missing: string[] }> };
  engagement: {
    windowDays: number;
    activeMembers: number;
    engagedMembers: number;
    engagementPercent: number;
    eventCount: number;
    attendanceRecords: number;
    attendanceByStatus: Array<{ label: string; count: number }>;
    participationByType: Array<{ label: string; count: number }>;
    trend: Array<{ startsAt: string; count: number }>;
    comparison: {
      attendanceRecords: Comparison;
      engagedMembers: Comparison;
      engagementPercent: Comparison;
      eventCount: Comparison;
    };
  };
  volunteerCoverage: {
    windowDays: number;
    groupCount: number;
    volunteerCount: number;
    shiftCount: number;
    requiredSlots: number;
    coveredSlots: number;
    openSlots: number;
    coveragePercent: number;
    comparison: {
      coveragePercent: Comparison;
      coveredSlots: Comparison;
      shifts: Comparison;
    };
    gaps: Array<{ shiftId: string; title: string; groupName: string; startsAt: string; capacity: number; assigned: number; openSlots: number }>;
  };
};

const defaultOrder = DEFAULT_MEMBERSHIP_DASHBOARD_LAYOUT.order;
const defaultWidths = DEFAULT_MEMBERSHIP_DASHBOARD_LAYOUT.widths;
const blockLabels: Record<BlockId, string> = {
  birthdays: "Upcoming birthdays",
  anniversaries: "Upcoming anniversaries",
  profiles: "Incomplete profiles",
  engagement: "Engagement & attendance",
  volunteer: "Volunteer coverage"
};

function friendlyLabel(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function dateLabel(value: string, includeTime = false) {
  return new Date(value).toLocaleDateString(undefined, includeTime
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", timeZone: "UTC" });
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">{children}</p>;
}

function Metric({ value, label }: { value: number | string; label: string }) {
  return <div className="rounded-xl bg-mist/35 p-3"><p className="text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p><p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p></div>;
}

function ComparisonMetric({ comparison, label, percent = false }: { comparison: Comparison; label: string; percent?: boolean }) {
  const changeLabel = percent
    ? `${comparison.change > 0 ? "+" : ""}${comparison.change} pts`
    : comparison.changePercent === null
      ? comparison.change === 0 ? "No change" : "No prior baseline"
      : `${comparison.changePercent > 0 ? "+" : ""}${comparison.changePercent}%`;
  return <div className="rounded-xl bg-mist/35 p-3">
    <p className="text-2xl font-semibold tabular-nums">{comparison.current.toLocaleString()}{percent ? "%" : ""}</p>
    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p>
    <p className={`mt-2 text-xs font-semibold ${comparison.change > 0 ? "text-coral" : "text-ink/50"}`}>
      {changeLabel} <span className="font-normal">vs {comparison.prior.toLocaleString()}{percent ? "%" : ""} prior</span>
    </p>
  </div>;
}

function AnnualList({ items, empty, anniversary = false }: { items: AnnualItem[]; empty: string; anniversary?: boolean }) {
  if (!items.length) return <EmptyState>{empty}</EmptyState>;
  return <ul className="mt-4 divide-y divide-ink/10">
    {items.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <a href={`/admin/membership/individuals/${item.id}/edit`} className="focus-ring min-w-0 truncate font-semibold text-coral hover:underline">{item.name}</a>
      <span className="shrink-0 text-right text-sm text-ink/60">{dateLabel(item.date)}{anniversary && item.years ? <span className="block text-xs">{item.years} years</span> : null}</span>
    </li>)}
  </ul>;
}

function BlockContent({ id, data }: { id: BlockId; data: DashboardData }) {
  if (id === "birthdays") return <section>
    <h3 className="font-serif text-2xl">{blockLabels[id]}</h3>
    <p className="mt-1 text-sm text-ink/60">The next {data.dateWindowDays} days.</p>
    <AnnualList items={data.birthdays} empty="No birthdays in this window." />
  </section>;

  if (id === "anniversaries") return <section>
    <h3 className="font-serif text-2xl">{blockLabels[id]}</h3>
    <p className="mt-1 text-sm text-ink/60">Wedding anniversaries in the next {data.dateWindowDays} days.</p>
    <AnnualList items={data.anniversaries} empty="No anniversaries in this window." anniversary />
  </section>;

  if (id === "profiles") return <section>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-serif text-2xl">{blockLabels[id]}</h3><p className="mt-1 text-sm text-ink/60">Essential email, phone, and address details.</p></div><span className="rounded-full bg-mist px-3 py-1 text-sm font-semibold">{data.incompleteProfiles.completionPercent}% complete</span></div>
    {!data.incompleteProfiles.count ? <EmptyState>All active member profiles have essential contact details.</EmptyState> : <><p className="mt-4 text-sm font-semibold">{data.incompleteProfiles.count.toLocaleString()} profile{data.incompleteProfiles.count === 1 ? "" : "s"} need attention</p><ul className="mt-2 divide-y divide-ink/10">{data.incompleteProfiles.members.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><a href={`/admin/membership/individuals/${member.id}/edit`} className="focus-ring font-semibold text-coral hover:underline">{member.name}</a><span className="text-xs text-ink/55">Missing {member.missing.join(", ")}</span></li>)}</ul></>}
  </section>;

  if (id === "engagement") {
    const chartItems = data.engagement.attendanceByStatus.map((item) => ({ ...item, label: friendlyLabel(item.label) }));
    const trendItems = data.engagement.trend.map((item) => ({ label: dateLabel(item.startsAt), count: item.count }));
    return <section>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-serif text-2xl">{blockLabels[id]}</h3><p className="mt-1 text-sm text-ink/60">Last {data.engagement.windowDays} days compared with the preceding {data.engagement.windowDays} days.</p></div><a href="/admin/membership/attendance" className="focus-ring text-sm font-semibold text-coral hover:underline">Manage attendance</a></div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><ComparisonMetric comparison={data.engagement.comparison.engagementPercent} label="members engaged" percent /><ComparisonMetric comparison={data.engagement.comparison.engagedMembers} label="people present" /><ComparisonMetric comparison={data.engagement.comparison.attendanceRecords} label="present records" /><ComparisonMetric comparison={data.engagement.comparison.eventCount} label="events" /></div>
      {trendItems.length ? <div className="mt-4"><ReportSummaryChart title="Weekly attendance trend" items={trendItems} noun="present records" mode="trend" description={`Present attendance by week during the last ${data.engagement.windowDays} days.`} /></div> : null}
      {chartItems.length ? <div className="mt-4"><ReportSummaryChart title="Attendance outcomes" items={chartItems} noun="records" /></div> : <EmptyState>No attendance has been recorded in this window.</EmptyState>}
    </section>;
  }

  const coverageItems = data.volunteerCoverage.requiredSlots
    ? [{ label: "Covered", count: data.volunteerCoverage.coveredSlots }, { label: "Open", count: data.volunteerCoverage.openSlots }]
    : [];
  return <section>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-serif text-2xl">{blockLabels[id]}</h3><p className="mt-1 text-sm text-ink/60">Next {data.volunteerCoverage.windowDays} days compared with the preceding {data.volunteerCoverage.windowDays} days.</p></div><div className="text-right"><a href="/admin/membership/volunteers" className="focus-ring text-sm font-semibold text-coral hover:underline">Manage volunteers</a><p className="mt-1 text-xs text-ink/55">{data.volunteerCoverage.volunteerCount} volunteers · {data.volunteerCoverage.groupCount} groups</p></div></div>
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><ComparisonMetric comparison={data.volunteerCoverage.comparison.coveragePercent} label="coverage" percent /><ComparisonMetric comparison={data.volunteerCoverage.comparison.shifts} label="shifts" /><ComparisonMetric comparison={data.volunteerCoverage.comparison.coveredSlots} label="covered slots" /><Metric value={data.volunteerCoverage.openSlots} label="open slots" /></div>
    {coverageItems.length ? <div className="mt-4"><ReportSummaryChart title="Upcoming volunteer coverage" items={coverageItems} noun="slots" /></div> : <EmptyState>No capacity-based volunteer shifts are scheduled in this window.</EmptyState>}
    {data.volunteerCoverage.gaps.length > 0 && <div className="mt-4"><h4 className="text-sm font-semibold">Shifts needing volunteers</h4><ul className="mt-2 divide-y divide-ink/10">{data.volunteerCoverage.gaps.map((gap) => <li key={gap.shiftId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><strong>{gap.title}</strong><span className="ml-2 text-ink/55">{gap.groupName} · {dateLabel(gap.startsAt, true)}</span></span><span className="font-semibold text-coral">{gap.openSlots} open</span></li>)}</ul></div>}
  </section>;
}

function SortableBlock({ id, width, sortOrder, data, dragLocked }: { id: BlockId; width: Width; sortOrder: number; data: DashboardData; dragLocked: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: dragLocked });
  return <div ref={setNodeRef} style={{ order: sortOrder, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} {...attributes} className={`${width === "quarter" ? "lg:col-span-1" : width === "half" ? "lg:col-span-2" : "lg:col-span-4"} rounded-2xl border bg-white p-5 shadow-sm ${isDragging ? "border-coral/50 opacity-70 shadow-xl" : "border-ink/10"}`}>
    <div className="mb-4 flex items-center justify-between">{!dragLocked && <button type="button" {...listeners} className="focus-ring touch-none cursor-grab rounded-md bg-mist px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink/50" aria-label={`Drag ${blockLabels[id]}`}>☷</button>}<span className="text-xs text-ink/35">{blockLabels[id]}</span></div>
    <BlockContent id={id} data={data} />
  </div>;
}

function LoadingDashboard() {
  return <div className="mt-6 grid gap-6 lg:grid-cols-4" role="status" aria-label="Loading membership dashboard">{defaultOrder.map((id) => <div key={id} className={`${defaultWidths[id] === "quarter" ? "lg:col-span-1" : defaultWidths[id] === "half" ? "lg:col-span-2" : "lg:col-span-4"} h-48 animate-pulse rounded-2xl border border-ink/10 bg-white p-5`}><div className="h-4 w-28 rounded bg-ink/10" /><div className="mt-6 h-8 w-48 rounded bg-ink/10" /><div className="mt-5 h-20 rounded bg-mist" /></div>)}</div>;
}

export function MembershipDashboard({ sharedConfigureOpen, dragLocked = false, hideConfigureButton = false, hideConfigurePanel = false, disableDnd = false, orderOverride }: { sharedConfigureOpen?: boolean; dragLocked?: boolean; hideConfigureButton?: boolean; hideConfigurePanel?: boolean; disableDnd?: boolean; orderOverride?: string[] } = {}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<BlockId[]>([...defaultOrder]);
  const [visible, setVisible] = useState<Record<BlockId, boolean>>({ ...DEFAULT_MEMBERSHIP_DASHBOARD_LAYOUT.visible });
  const [widths, setWidths] = useState<Record<BlockId, Width>>({ ...defaultWidths });
  const [configureOpen, setConfigureOpen] = useState(false);
  const [internalConfigureOpen, setInternalConfigureOpen] = useState(false);
  const [layoutStatus, setLayoutStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const layoutRequestQueue = useRef<Promise<void>>(Promise.resolve());
  const layoutRequestVersion = useRef(0);
  const dashboardRef = useRef<HTMLElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const applyLayout = useCallback((layout: MembershipDashboardLayout) => {
    setOrder(layout.order);
    setVisible(layout.visible);
    setWidths(layout.widths);
  }, []);

  const queueLayoutRequest = useCallback((method: "PATCH" | "DELETE", layout?: MembershipDashboardLayout) => {
    const version = ++layoutRequestVersion.current;
    setLayoutStatus("saving");
    const request = layoutRequestQueue.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/membership/dashboard", {
        method,
        headers: method === "PATCH" ? { "Content-Type": "application/json" } : undefined,
        body: method === "PATCH" ? JSON.stringify(layout) : undefined
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to save dashboard layout.");
    });
    layoutRequestQueue.current = request.catch(() => undefined);
    void request.then(() => {
      if (layoutRequestVersion.current === version) setLayoutStatus("saved");
    }).catch(() => {
      if (layoutRequestVersion.current === version) setLayoutStatus("error");
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let browserLayout: MembershipDashboardLayout | null = null;
      const browserValue = localStorage.getItem("membership-dashboard-layout");
      if (browserValue) {
        try {
          browserLayout = normalizeDashboardLayout(JSON.parse(browserValue));
        } catch {
          localStorage.removeItem("membership-dashboard-layout");
        }
      }
      const response = await fetch("/api/membership/dashboard", { cache: "no-store" });
      const value = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(value.error ?? "Unable to load membership dashboard.");
      const layout = value.layoutSaved || !browserLayout ? normalizeDashboardLayout(value.layout) : browserLayout;
      applyLayout(layout);
      localStorage.setItem("membership-dashboard-layout", JSON.stringify(layout));
      if (!value.layoutSaved && browserLayout) queueLayoutRequest("PATCH", layout);
      setData(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load membership dashboard.");
    } finally {
      setLoading(false);
    }
  }, [applyLayout, queueLayoutRequest]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!internalConfigureOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => { if (!dashboardRef.current?.contains(event.target as Node)) setInternalConfigureOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setInternalConfigureOpen(false); };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, [internalConfigureOpen]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("membership-dashboard-layout-changed", refresh);
    return () => window.removeEventListener("membership-dashboard-layout-changed", refresh);
  }, [load]);

  const saveLayout = (nextOrder = order, nextVisible = visible, nextWidths = widths) => {
    const layout = normalizeDashboardLayout({ order: nextOrder, visible: nextVisible, widths: nextWidths });
    applyLayout(layout);
    localStorage.setItem("membership-dashboard-layout", JSON.stringify(layout));
    queueLayoutRequest("PATCH", layout);
  };
  const resetLayout = () => {
    const layout = normalizeDashboardLayout(null);
    applyLayout(layout);
    localStorage.removeItem("membership-dashboard-layout");
    queueLayoutRequest("DELETE");
  };
  const visibleOrder = useMemo(() => (orderOverride ?? order).filter((id) => visible[id as BlockId]), [order, orderOverride, visible]);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = [...order];
    const from = next.indexOf(active.id as BlockId);
    next.splice(from, 1);
    next.splice(next.indexOf(over.id as BlockId), 0, active.id as BlockId);
    saveLayout(next);
  };

  const isConfigureOpen = sharedConfigureOpen ?? internalConfigureOpen;
  return <section ref={dashboardRef} className={disableDnd ? "contents" : "mt-8"} aria-labelledby="membership-dashboard-heading">
    {!disableDnd && <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="membership-dashboard-heading" className="sr-only">Dashboard blocks</h2><p className="sr-only">At-a-glance care, engagement, and serving insights. Your layout follows your account across devices.</p></div><div className="relative">{!hideConfigureButton && <button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" aria-expanded={isConfigureOpen} onClick={() => setInternalConfigureOpen((open) => !open)}>Configure dashboard</button>}</div></div>}
    {loading ? <LoadingDashboard /> : error ? <div className="mt-6 rounded-xl border border-coral/25 bg-coral/5 p-5" role="alert"><p className="font-semibold text-coral">Dashboard unavailable</p><p className="mt-1 text-sm text-ink/65">{error}</p><button type="button" onClick={() => void load()} className="focus-ring mt-4 rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Try again</button></div> : visibleOrder.length && data ? disableDnd ? <div className="contents">{visibleOrder.map((id) => <SortableBlock key={id} id={id as BlockId} dragLocked={dragLocked} sortOrder={(orderOverride ?? order).indexOf(id)} width={widths[id as BlockId]} data={data} />)}</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}><div className="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-4">{visibleOrder.map((id) => <SortableBlock key={id} id={id as BlockId} dragLocked={dragLocked} sortOrder={(orderOverride ?? order).indexOf(id)} width={widths[id as BlockId]} data={data} />)}</div></SortableContext></DndContext> : null}
  </section>;
}
