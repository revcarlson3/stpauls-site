"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { closestCenter, DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import DashboardBlocks from "./dashboard-blocks";
import { MembershipDashboard } from "./membership/membership-dashboard";
import { EventsDashboard } from "./events-dashboard";
import { Card } from "@/components/ui";
import { hasPublicWebsiteModuleAccess, PUBLIC_WEBSITE_LINKS } from "@/lib/modules";

const panelLabels: Record<string, string> = {
  activity: "Recent activity",
  sms: "SMS history",
  email: "Email history",
  birthdays: "Upcoming birthdays",
  anniversaries: "Wedding anniversaries",
  profiles: "Incomplete profiles",
  engagement: "Engagement and attendance",
  volunteer: "Volunteer coverage",
  upcoming: "Upcoming events",
  attendance: "Attendance activity",
  "events-volunteer": "Volunteer scheduling",
  reporting: "Events reporting"
};

export default function AdminDashboard() {
  const [configureOpen, setConfigureOpen] = useState(false);
  const [order, setOrder] = useState(["activity", "sms", "email", "birthdays", "anniversaries", "profiles", "engagement", "volunteer", "upcoming", "attendance", "events-volunteer", "reporting"]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dashboardLocked, setDashboardLocked] = useState(false);
  const [publicWebsitePermissions, setPublicWebsitePermissions] = useState<string[]>([]);
  const [publicWebsiteAvailable, setPublicWebsiteAvailable] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stored = window.localStorage.getItem("admin-dashboard-combined-layout");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length === 12 && parsed.every((id) => typeof id === "string")) setOrder(parsed);
    } catch {
      window.localStorage.removeItem("admin-dashboard-combined-layout");
    }
    setDashboardLocked(window.localStorage.getItem("admin-dashboard-locked") === "true");
  }, []);
  useEffect(() => {
    if (!configureOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!dashboardRef.current?.contains(target)) setConfigureOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setConfigureOpen(false); };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, [configureOpen]);
  useEffect(() => {
    void Promise.all([fetch("/api/modules"), fetch("/api/account")]).then(async ([modulesResponse, accountResponse]) => {
      if (!modulesResponse.ok || !accountResponse.ok) return;
      const modulesValue = await modulesResponse.json();
      const accountValue = await accountResponse.json();
      const permissions = Array.isArray(accountValue.permissions) ? accountValue.permissions.filter((permission: unknown): permission is string => typeof permission === "string") : [];
      setPublicWebsitePermissions(permissions);
      setPublicWebsiteAvailable(hasPublicWebsiteModuleAccess((modulesValue.modules ?? []).map((module: { slug: string }) => module.slug), permissions));
    }).catch(() => undefined);
  }, []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (dashboardLocked) return;
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const next = [...current];
      const from = next.indexOf(String(active.id));
      next.splice(from, 1);
      next.splice(next.indexOf(String(over.id)), 0, String(active.id));
      window.localStorage.setItem("admin-dashboard-combined-layout", JSON.stringify(next));
      return next;
    });
  };
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

  return <div ref={dashboardRef} className="relative mt-2">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-serif text-4xl">Admin Dashboard</h1>
      <button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" aria-expanded={configureOpen} onClick={() => setConfigureOpen((open) => !open)}>Configure Dashboard</button>
    </div>
    {publicWebsiteAvailable && <Card className="mb-8 p-6 sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-coral">Public Website</p><p className="mt-2 text-sm text-ink/60">Manage the public-facing pages and presentation for this site.</p><div className="mt-5 flex flex-wrap gap-3">{PUBLIC_WEBSITE_LINKS.filter((link) => publicWebsitePermissions.includes(link.permission)).map((link) => <Link key={link.href} href={link.href} className="focus-ring rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold hover:border-coral hover:text-coral">{link.label}</Link>)}</div></Card>}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragCancel={() => setActiveId(null)} onDragEnd={(event) => { handleDragEnd(event); setActiveId(null); }}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-4">
          <DashboardBlocks sharedConfigureOpen={configureOpen} onSharedConfigureClose={() => setConfigureOpen(false)} dragLocked={dashboardLocked} onDashboardLockChange={(locked) => { setDashboardLocked(locked); window.localStorage.setItem("admin-dashboard-locked", String(locked)); }} hideConfigureButton disableDnd orderOverride={order} />
          <MembershipDashboard sharedConfigureOpen={configureOpen} dragLocked={dashboardLocked} hideConfigureButton hideConfigurePanel disableDnd orderOverride={order} />
          <EventsDashboard sharedOrder={order} dragLocked={dashboardLocked} />
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {activeId ? <div className="w-[min(28rem,calc(100vw-2rem))] rotate-[1.5deg] rounded-2xl border border-coral/40 bg-white/95 p-5 shadow-[0_24px_60px_-18px_rgba(38,33,28,0.45)] ring-1 ring-coral/10 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral text-lg text-white shadow-sm">☷</span>
              <div className="min-w-0">
                <p className="truncate font-serif text-xl text-ink">{panelLabels[activeId] ?? "Dashboard panel"}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Repositioning panel</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-mist px-3 py-1 text-xs font-semibold text-ink/60">Drop to place</span>
          </div>
        </div> : null}
      </DragOverlay>
    </DndContext>
  </div>;
}
