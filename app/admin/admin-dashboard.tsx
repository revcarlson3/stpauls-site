"use client";

import { useEffect, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import DashboardBlocks from "./dashboard-blocks";
import { MembershipDashboard } from "./membership/membership-dashboard";

export default function AdminDashboard() {
  const [configureOpen, setConfigureOpen] = useState(false);
  const [order, setOrder] = useState(["activity", "sms", "email", "birthdays", "anniversaries", "profiles", "engagement", "volunteer"]);
  useEffect(() => {
    const stored = window.localStorage.getItem("admin-dashboard-combined-layout");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length === 8 && parsed.every((id) => typeof id === "string")) setOrder(parsed);
    } catch {
      window.localStorage.removeItem("admin-dashboard-combined-layout");
    }
  }, []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
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

  return <div className="relative mt-8">
    <div className="flex justify-end">
      <button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" aria-expanded={configureOpen} onClick={() => setConfigureOpen((open) => !open)}>Configure Dashboard</button>
    </div>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="grid gap-8 sm:grid-cols-2">
          <DashboardBlocks sharedConfigureOpen={configureOpen} hideConfigureButton disableDnd orderOverride={order} />
          <MembershipDashboard sharedConfigureOpen={configureOpen} hideConfigureButton hideConfigurePanel disableDnd orderOverride={order} />
        </div>
      </SortableContext>
    </DndContext>
  </div>;
}
