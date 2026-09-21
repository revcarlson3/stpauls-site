"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui";
import { DEFAULT_MEMBERSHIP_DASHBOARD_LAYOUT, MEMBERSHIP_DASHBOARD_BLOCK_IDS, normalizeDashboardLayout, type MembershipDashboardLayout } from "@/lib/membership-dashboard-shared";

type BlockId = "activity" | "sms" | "email";
type AuditLog = { id: string; activityType: string; summary: string; details: string | null; createdAt: string; actor: { name: string; email: string } | null };
type Message = { id: string; channel: "EMAIL" | "SMS"; subject: string | null; status: string; deliveryNote: string | null; createdAt: string; createdBy: { name: string }; recipients: Array<{ displayName: string; address: string; status: string; deliveredAt: string | null }> };

const blockLabels: Record<BlockId, string> = { activity: "Recent Activity", sms: "SMS History", email: "Email History" };
const defaultOrder: BlockId[] = ["activity", "sms", "email"];
const defaultWidths: Record<BlockId, "quarter" | "half" | "full"> = { activity: "full", sms: "half", email: "half" };
const eventBlockLabels = { upcoming: "Upcoming events", attendance: "Attendance activity", "events-volunteer": "Volunteer scheduling", reporting: "Events reporting" } as const;
const activityLabels: Record<string, string> = {
  "user-created": "User created", "user-updated": "User updated", "user-deleted": "User deleted",
  "invitation-created": "Invitation created", "invitation-accepted": "Invitation accepted", "invitation-resent": "Invitation resent", "invitation-revoked": "Invitation revoked",
  "email-change-requested": "Email change requested", "email-changed": "Email changed", "sessions-revoked": "Sessions revoked",
  "group-created": "Group created", "group-updated": "Group updated", "group-deleted": "Group deleted",
  "membership-note-created": "Membership note created", "membership-note-updated": "Membership note updated", "membership-note-deleted": "Membership note deleted",
  "membership-document-uploaded": "Membership document uploaded", "membership-document-downloaded": "Membership document downloaded", "membership-document-deleted": "Membership document deleted",
  "membership-message-created": "Membership message sent", "membership-message-template-created": "Message template created", "membership-message-template-updated": "Message template updated", "membership-message-template-deleted": "Message template deleted"
};

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(total / 5);
  if (pages <= 1) return null;
  return <div className="mt-4 flex items-center justify-between text-xs text-ink/60"><span>Page {page + 1} of {pages}</span><div className="flex gap-2"><button type="button" disabled={page === 0} onClick={() => onChange(page - 1)} className="focus-ring rounded-full border border-ink/15 px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={page === pages - 1} onClick={() => onChange(page + 1)} className="focus-ring rounded-full border border-ink/15 px-3 py-1.5 font-semibold disabled:opacity-40">Next</button></div></div>;
}

function HistoryBlock({ title, messages, page, onPageChange }: { title: string; messages: Message[]; page: number; onPageChange: (page: number) => void }) {
  const visibleMessages = messages.slice(page * 5, page * 5 + 5);
  return <section><h2 className="font-serif text-2xl">{title}</h2><p className="mt-1 text-sm text-ink/60">Five messages per page.</p><div className="mt-4 grid gap-3">{visibleMessages.length ? visibleMessages.map((message) => <Card key={message.id} className="p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{message.subject ?? "Text message"}</p><time className="text-xs text-ink/50" dateTime={message.createdAt}>{dateLabel(message.createdAt)}</time></div><p className="mt-1 text-xs text-ink/60">{message.status} · {message.recipients.length} recipient{message.recipients.length === 1 ? "" : "s"} · {message.createdBy.name}</p>{message.deliveryNote && <p className="mt-2 text-sm text-ink/70">{message.deliveryNote}</p>}</Card>) : <p className="rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No messages sent yet.</p>}</div><Pagination page={page} total={messages.length} onChange={onPageChange} /></section>;
}

export default function DashboardBlocks({ sharedConfigureOpen, onSharedConfigureClose, dragLocked = false, onDashboardLockChange, hideConfigureButton = false, disableDnd = false, orderOverride }: { sharedConfigureOpen?: boolean; onSharedConfigureClose?: () => void; dragLocked?: boolean; onDashboardLockChange?: (locked: boolean) => void; hideConfigureButton?: boolean; disableDnd?: boolean; orderOverride?: string[] } = {}) {
  const [order, setOrder] = useState<BlockId[]>(defaultOrder);
  const [visible, setVisible] = useState<Record<BlockId, boolean>>({ activity: true, sms: true, email: true });
  const [widths, setWidths] = useState<Record<BlockId, "quarter" | "half" | "full">>(defaultWidths);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [pages, setPages] = useState<Record<BlockId, number>>({ activity: 0, sms: 0, email: 0 });
  const [internalConfigureOpen, setInternalConfigureOpen] = useState(false);
  const [membershipLayout, setMembershipLayout] = useState<MembershipDashboardLayout | null>(null);
  const [eventVisible, setEventVisible] = useState<Record<keyof typeof eventBlockLabels, boolean>>({ upcoming: true, attendance: true, "events-volunteer": true, reporting: true });
  const [eventWidths, setEventWidths] = useState<Record<keyof typeof eventBlockLabels, "quarter" | "half" | "full">>({ upcoming: "half", attendance: "half", "events-volunteer": "half", reporting: "half" });
  const configureRef = useRef<HTMLDivElement>(null);
  const isConfigureOpen = sharedConfigureOpen ?? internalConfigureOpen;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("admin-dashboard-layout") ?? "null") as { order?: BlockId[]; visible?: Record<BlockId, boolean>; widths?: Record<BlockId, "quarter" | "half" | "full"> } | null;
      if (saved?.order?.every((id) => defaultOrder.includes(id)) && saved.order.length === defaultOrder.length) setOrder(saved.order);
      if (saved?.visible) setVisible((current) => ({ ...current, ...saved.visible }));
      if (saved?.widths) setWidths((current) => ({ ...current, ...saved.widths }));
      const eventsSaved = JSON.parse(localStorage.getItem("events-dashboard-layout") ?? "null") as { visible?: Partial<Record<keyof typeof eventBlockLabels, boolean>> } | null;
      if (eventsSaved?.visible) setEventVisible((current) => ({ ...current, ...eventsSaved.visible }));
      if (eventsSaved && typeof eventsSaved === "object" && "widths" in eventsSaved && eventsSaved.widths && typeof eventsSaved.widths === "object") setEventWidths((current) => ({ ...current, ...(eventsSaved.widths as Partial<Record<keyof typeof eventBlockLabels, "quarter" | "half" | "full">>) }));
    } catch {
      // Ignore malformed local preferences and use the defaults.
    }
    void Promise.all([fetch("/api/audit"), fetch("/api/membership/messaging/history")]).then(async ([activityResponse, messageResponse]) => {
      const activityValue = await activityResponse.json();
      const messageValue = await messageResponse.json();
      if (!activityResponse.ok || !messageResponse.ok) throw new Error(activityValue.error ?? messageValue.error ?? "Unable to load dashboard history.");
      setLogs(activityValue);
      setMessages(messageValue);
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!isConfigureOpen || membershipLayout) return;
    void fetch("/api/membership/dashboard", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return null;
      const value = await response.json();
      return normalizeDashboardLayout(value.layout);
    }).then((layout) => {
      if (layout) setMembershipLayout(layout);
    }).catch(() => undefined);
  }, [isConfigureOpen, membershipLayout]);

  useEffect(() => {
    if (!isConfigureOpen) return;
    const close = () => {
      if (sharedConfigureOpen !== undefined) onSharedConfigureClose?.();
      else setInternalConfigureOpen(false);
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!configureRef.current?.contains(event.target as Node)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isConfigureOpen, onSharedConfigureClose, sharedConfigureOpen]);

  const saveLayout = (nextOrder: BlockId[], nextVisible: Record<BlockId, boolean>, nextWidths = widths) => {
    setOrder(nextOrder);
    setVisible(nextVisible);
    setWidths(nextWidths);
    localStorage.setItem("admin-dashboard-layout", JSON.stringify({ order: nextOrder, visible: nextVisible, widths: nextWidths }));
  };
  const visibleOrder = useMemo(() => (orderOverride ?? order).filter((id) => visible[id as BlockId]), [order, orderOverride, visible]);
  const moveBlock = (activeId: string, overId: string) => {
    const dragged = activeId as BlockId;
    const target = overId as BlockId;
    if (dragged === target) return;
    const next = [...order];
    const from = next.indexOf(dragged);
    next.splice(from, 1);
    next.splice(next.indexOf(target), 0, dragged);
    saveLayout(next, visible);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) moveBlock(String(active.id), String(over.id));
  };
  const saveMembershipLayout = (layout: MembershipDashboardLayout) => {
    setMembershipLayout(layout);
    void fetch("/api/membership/dashboard", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(layout) });
    window.dispatchEvent(new Event("membership-dashboard-layout-changed"));
  };

  const saveEventVisibility = (id: keyof typeof eventBlockLabels, checked: boolean) => {
    const next = { ...eventVisible, [id]: checked };
    setEventVisible(next);
    localStorage.setItem("events-dashboard-layout", JSON.stringify({ visible: next, widths: eventWidths }));
    window.dispatchEvent(new Event("events-dashboard-layout-changed"));
  };
  const saveEventWidth = (id: keyof typeof eventBlockLabels, width: "quarter" | "half" | "full") => {
    const next = { ...eventWidths, [id]: width };
    setEventWidths(next);
    localStorage.setItem("events-dashboard-layout", JSON.stringify({ visible: eventVisible, widths: next }));
    window.dispatchEvent(new Event("events-dashboard-layout-changed"));
  };

  return <div className={`${disableDnd ? "contents" : "mt-8"} relative`}>
    <div ref={configureRef} className={disableDnd ? "absolute right-0 top-12 z-20" : "flex flex-wrap items-end justify-between gap-4"}><div className={disableDnd ? "hidden" : ""}><h2 className="font-serif text-2xl">Dashboard blocks</h2><p className="mt-1 text-sm text-ink/60">Drag blocks to reorder them. Your layout is saved in this browser.</p></div><div className="relative">{!hideConfigureButton && <button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" onClick={() => setInternalConfigureOpen((open) => !open)}>Configure dashboard</button>}{isConfigureOpen && <div className="absolute right-0 z-10 grid max-h-[min(80vh,42rem)] w-72 gap-3 overflow-y-auto rounded-xl border border-ink/10 bg-white p-3 shadow-lg"><label className="flex items-center gap-2 border-b border-ink/10 pb-3 text-sm font-semibold"><input type="checkbox" checked={dragLocked} onChange={(event) => onDashboardLockChange?.(event.target.checked)} />Lock the dashboard</label><p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Dashboard blocks</p>{defaultOrder.map((id) => <div key={id} className="grid gap-1"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visible[id]} onChange={(event) => saveLayout(order, { ...visible, [id]: event.target.checked })} />{blockLabels[id]}</label><select aria-label={`${blockLabels[id]} width`} value={widths[id]} onChange={(event) => saveLayout(order, visible, { ...widths, [id]: event.target.value as "quarter" | "half" | "full" })} className="ml-6 rounded-md border border-ink/10 px-2 py-1 text-xs"><option value="quarter">One column</option><option value="half">Two columns</option><option value="full">Four columns</option></select></div>)}<p className="border-t border-ink/10 pt-3 text-xs font-semibold uppercase tracking-wide text-ink/50">Membership insight blocks</p>{MEMBERSHIP_DASHBOARD_BLOCK_IDS.map((id) => { const layout = membershipLayout ?? DEFAULT_MEMBERSHIP_DASHBOARD_LAYOUT; return <div key={id} className="grid gap-1"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={layout.visible[id]} onChange={(event) => saveMembershipLayout(normalizeDashboardLayout({ ...layout, visible: { ...layout.visible, [id]: event.target.checked } }))} />{id === "birthdays" ? "Upcoming birthdays" : id === "anniversaries" ? "Upcoming anniversaries" : id === "profiles" ? "Incomplete profiles" : id === "engagement" ? "Engagement & attendance" : "Volunteer coverage"}</label>    <select aria-label={`${id} width`} value={layout.widths[id]} onChange={(event) => saveMembershipLayout(normalizeDashboardLayout({ ...layout, widths: { ...layout.widths, [id]: event.target.value as "quarter" | "half" | "full" } }))} className="ml-6 rounded-md border border-ink/10 px-2 py-1 text-xs"><option value="quarter">One column</option><option value="half">Two columns</option><option value="full">Four columns</option></select></div>; })}    <p className="border-t border-ink/10 pt-3 text-xs font-semibold uppercase tracking-wide text-ink/50">Events and scheduling panels</p>{Object.entries(eventBlockLabels).map(([id, label]) => <div key={id} className="grid gap-1"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={eventVisible[id as keyof typeof eventBlockLabels]} onChange={(event) => saveEventVisibility(id as keyof typeof eventBlockLabels, event.target.checked)} />{label}</label><select aria-label={`${label} width`} value={eventWidths[id as keyof typeof eventBlockLabels]} onChange={(event) => saveEventWidth(id as keyof typeof eventBlockLabels, event.target.value as "quarter" | "half" | "full")} className="ml-6 rounded-md border border-ink/10 px-2 py-1 text-xs"><option value="quarter">One column</option><option value="half">Two columns</option><option value="full">Four columns</option></select></div>)}</div>}</div></div>
    {error ? <p role="alert" className="mt-4 text-sm text-coral">{error}</p> : !visibleOrder.length ? null : disableDnd ? <div className="contents">{visibleOrder.map((id) => { const blockMessages = messages.filter((message) => message.channel === (id === "email" ? "EMAIL" : "SMS")); return <DashboardBlock key={id} id={id as BlockId} dragLocked={dragLocked} sortOrder={(orderOverride ?? order).indexOf(id)} width={widths[id as BlockId]} blockPage={pages[id as BlockId]} logs={logs} messages={blockMessages} onPageChange={(page) => setPages((current) => ({ ...current, [id as BlockId]: page }))} />; })}</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}><div className="mt-6 grid gap-8 grid-cols-1 lg:grid-cols-4">{visibleOrder.map((id) => { const blockMessages = messages.filter((message) => message.channel === (id === "email" ? "EMAIL" : "SMS")); const blockPage = pages[id as BlockId]; return <DashboardBlock key={id} id={id as BlockId} dragLocked={dragLocked} sortOrder={(orderOverride ?? order).indexOf(id)} width={widths[id as BlockId]} blockPage={blockPage} logs={logs} messages={blockMessages} onPageChange={(page) => setPages((current) => ({ ...current, [id as BlockId]: page }))} />; })}</div></SortableContext></DndContext>}
  </div>;
}

function DashboardBlock({ id, dragLocked, width, sortOrder, blockPage, logs, messages, onPageChange }: { id: BlockId; dragLocked: boolean; width: "quarter" | "half" | "full"; sortOrder: number; blockPage: number; logs: AuditLog[]; messages: Message[]; onPageChange: (page: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: dragLocked });
  return <div ref={setNodeRef} style={{ order: sortOrder, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} {...attributes} className={`${width === "quarter" ? "lg:col-span-1" : width === "half" ? "lg:col-span-2" : "lg:col-span-4"} min-w-0 rounded-2xl border bg-white p-5 shadow-sm transition ${isDragging ? "scale-[1.02] rotate-1 border-coral/50 shadow-xl opacity-70" : "border-ink/10"}`}>  <div className="mb-4 flex items-center justify-between">{!dragLocked && <span {...listeners} className="touch-none cursor-grab rounded-md bg-mist px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink/50" aria-hidden="true">☷</span>}<span className="text-xs text-ink/35">{blockLabels[id]}</span></div>{id === "activity" ? <section className="min-w-0"><h2 className="font-serif text-2xl">{blockLabels.activity}</h2><p className="mt-1 text-sm text-ink/60">Five activity items per page.</p><div className="mt-4 grid min-w-0 gap-3">{logs.length ? logs.slice(blockPage * 5, blockPage * 5 + 5).map((log) => <Card key={log.id} className="min-w-0 overflow-hidden p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{log.summary}</p><time className="text-xs text-ink/50" dateTime={log.createdAt}>{dateLabel(log.createdAt)}</time></div><p className="mt-1 text-xs text-ink/60">{activityLabels[log.activityType] ?? log.activityType} · {log.actor ? `${log.actor.name} (${log.actor.email})` : "System"}</p>{log.details && <p className="mt-2 max-w-full whitespace-pre-wrap break-words text-sm text-ink/70 [overflow-wrap:anywhere]">{log.details}</p>}</Card>) : <p className="rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No recorded activity.</p>}</div><Pagination page={blockPage} total={logs.length} onChange={onPageChange} /></section> : <HistoryBlock title={blockLabels[id]} messages={messages} page={blockPage} onPageChange={onPageChange} />}</div>;
}
