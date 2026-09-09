"use client";

import { useEffect, useMemo, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui";

type BlockId = "activity" | "sms" | "email";
type AuditLog = { id: string; activityType: string; summary: string; details: string | null; createdAt: string; actor: { name: string; email: string } | null };
type Message = { id: string; channel: "EMAIL" | "SMS"; subject: string | null; status: string; deliveryNote: string | null; createdAt: string; createdBy: { name: string }; recipients: Array<{ displayName: string; address: string; status: string; deliveredAt: string | null }> };

const blockLabels: Record<BlockId, string> = { activity: "Recent Activity", sms: "SMS History", email: "Email History" };
const defaultOrder: BlockId[] = ["activity", "sms", "email"];
const defaultWidths: Record<BlockId, "half" | "full"> = { activity: "full", sms: "half", email: "half" };
const activityLabels: Record<string, string> = {
  "user-created": "User created", "user-updated": "User updated", "user-deleted": "User deleted",
  "invitation-created": "Invitation created", "invitation-accepted": "Invitation accepted", "invitation-resent": "Invitation resent", "invitation-revoked": "Invitation revoked",
  "email-change-requested": "Email change requested", "email-changed": "Email changed", "sessions-revoked": "Sessions revoked",
  "group-created": "Group created", "group-updated": "Group updated", "group-deleted": "Group deleted",
  "membership-note-created": "Membership note created", "membership-note-updated": "Membership note updated", "membership-note-deleted": "Membership note deleted",
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

export default function DashboardBlocks() {
  const [order, setOrder] = useState<BlockId[]>(defaultOrder);
  const [visible, setVisible] = useState<Record<BlockId, boolean>>({ activity: true, sms: true, email: true });
  const [widths, setWidths] = useState<Record<BlockId, "half" | "full">>(defaultWidths);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [pages, setPages] = useState<Record<BlockId, number>>({ activity: 0, sms: 0, email: 0 });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("admin-dashboard-layout") ?? "null") as { order?: BlockId[]; visible?: Record<BlockId, boolean>; widths?: Record<BlockId, "half" | "full"> } | null;
      if (saved?.order?.every((id) => defaultOrder.includes(id)) && saved.order.length === defaultOrder.length) setOrder(saved.order);
      if (saved?.visible) setVisible((current) => ({ ...current, ...saved.visible }));
      if (saved?.widths) setWidths((current) => ({ ...current, ...saved.widths }));
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

  const saveLayout = (nextOrder: BlockId[], nextVisible: Record<BlockId, boolean>, nextWidths = widths) => {
    setOrder(nextOrder);
    setVisible(nextVisible);
    setWidths(nextWidths);
    localStorage.setItem("admin-dashboard-layout", JSON.stringify({ order: nextOrder, visible: nextVisible, widths: nextWidths }));
  };
  const visibleOrder = useMemo(() => order.filter((id) => visible[id]), [order, visible]);
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

  return <div className="mt-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-serif text-2xl">Dashboard blocks</h2><p className="mt-1 text-sm text-ink/60">Drag blocks to reorder them. Your layout is saved in this browser.</p></div><div className="relative"><button type="button" className="focus-ring rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold" onClick={() => setConfigureOpen((open) => !open)}>Configure dashboard</button>{configureOpen && <div className="absolute right-0 z-10 mt-2 grid w-64 gap-3 rounded-xl border border-ink/10 bg-white p-3 shadow-lg"><p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Dashboard blocks</p>{defaultOrder.map((id) => <div key={id} className="grid gap-1"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visible[id]} onChange={(event) => saveLayout(order, { ...visible, [id]: event.target.checked })} />{blockLabels[id]}</label><select aria-label={`${blockLabels[id]} width`} value={widths[id]} onChange={(event) => saveLayout(order, visible, { ...widths, [id]: event.target.value as "half" | "full" })} className="ml-6 rounded-md border border-ink/10 px-2 py-1 text-xs"><option value="half">One column</option><option value="full">Two columns</option></select></div>)}</div>}</div></div>
    {error ? <p role="alert" className="mt-4 text-sm text-coral">{error}</p> : !visibleOrder.length ? <p className="mt-6 rounded-lg border border-dashed border-ink/15 p-5 text-sm text-ink/60">All dashboard blocks are hidden. Use Configure dashboard to show one.</p> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}><div className="mt-6 grid gap-8 sm:grid-cols-2">{visibleOrder.map((id) => { const blockMessages = messages.filter((message) => message.channel === (id === "email" ? "EMAIL" : "SMS")); const blockPage = pages[id]; const sortable = <DashboardBlock id={id} width={widths[id]} blockPage={blockPage} logs={logs} messages={blockMessages} onPageChange={(page) => setPages((current) => ({ ...current, [id]: page }))} />; return sortable; })}</div></SortableContext></DndContext>}
  </div>;
}

function DashboardBlock({ id, width, blockPage, logs, messages, onPageChange }: { id: BlockId; width: "half" | "full"; blockPage: number; logs: AuditLog[]; messages: Message[]; onPageChange: (page: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} {...attributes} className={`${width === "full" ? "sm:col-span-2" : ""} rounded-2xl border bg-white p-5 shadow-sm transition ${isDragging ? "scale-[1.02] rotate-1 border-coral/50 shadow-xl opacity-70" : "border-ink/10"}`}><div className="mb-4 flex items-center justify-between"><span {...listeners} className="touch-none cursor-grab rounded-md bg-mist px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink/50">☷ Drag block</span><span className="text-xs text-ink/35">{blockLabels[id]}</span></div>{id === "activity" ? <section><h2 className="font-serif text-2xl">{blockLabels.activity}</h2><p className="mt-1 text-sm text-ink/60">Five activity items per page.</p><div className="mt-4 grid gap-3">{logs.length ? logs.slice(blockPage * 5, blockPage * 5 + 5).map((log) => <Card key={log.id} className="p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{log.summary}</p><time className="text-xs text-ink/50" dateTime={log.createdAt}>{dateLabel(log.createdAt)}</time></div><p className="mt-1 text-xs text-ink/60">{activityLabels[log.activityType] ?? log.activityType} · {log.actor ? `${log.actor.name} (${log.actor.email})` : "System"}</p>{log.details && <p className="mt-2 text-sm text-ink/70">{log.details}</p>}</Card>) : <p className="rounded-lg border border-dashed border-ink/15 p-4 text-sm text-ink/60">No recorded activity.</p>}</div><Pagination page={blockPage} total={logs.length} onChange={onPageChange} /></section> : <HistoryBlock title={blockLabels[id]} messages={messages} page={blockPage} onPageChange={onPageChange} />}</div>;
}
