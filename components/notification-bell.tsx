"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Item = { id: string; title: string; message: string; link: string | null; category: string; readAt: string | null; createdAt: string; runId: string | null; sender?: { name: string; email: string } | null };
type Audience = { id: string; name: string; email?: string; groupId?: string | null };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [canSend, setCanSend] = useState(false);
  const [groups, setGroups] = useState<Audience[]>([]);
  const [users, setUsers] = useState<Audience[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [audience, setAudience] = useState("ADMINS");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [link, setLink] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [category, setCategory] = useState("GENERAL");
  const [mounted, setMounted] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, right: 16 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  async function load(before?: string | null) {
    const response = await fetch(`/api/notifications${before ? `?before=${encodeURIComponent(before)}` : ""}`, { cache: "no-store" });
    if (!response.ok) return;
    const value = await response.json();
    setItems((current) => before ? [...current, ...(value.notifications ?? [])] : (value.notifications ?? []));
    setUnread(value.unreadCount ?? 0);
    setHasMore(value.hasMore === true);
    setNextBefore(value.nextBefore ?? null);
    setCanSend(value.canSend === true);
    setGroups(value.groups ?? []);
    setUsers(value.users ?? []);
    setCurrentGroupId(value.currentGroupId ?? null);
  }
  useEffect(() => { setMounted(true); void load(); }, []);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setPanelPosition({ top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);
  function updatePanelPosition() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setPanelPosition({ top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) });
  }
  async function markRead(item: Item) {
    if (!item.readAt) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnread((current) => Math.max(0, current - 1));
    }
    if (item.link) window.location.href = item.link;
  }
  async function clearUnread() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearUnread: true }) });
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }
  async function remove(id: string) {
    await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setItems((current) => current.filter((item) => item.id !== id));
  }
  async function send() {
    const isGlobal = audience === "GLOBAL";
    if (isGlobal && !window.confirm("Send this notification to every active user, including linked members?")) return;
    const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, message, link, category, targetType: audience === "MY_GROUP" ? "GROUP" : audience, targetId: audience === "MY_GROUP" ? currentGroupId : targetId, confirmGlobal: isGlobal }) });
    const value = await response.json();
    setFeedback(response.ok ? `Sent to ${value.sent} user(s).` : value.error ?? "Unable to send notification.");
    if (response.ok) { setTitle(""); setMessage(""); setLink(""); }
  }
  const audienceUsers = audience === "GROUP" || audience === "MY_GROUP" ? users.filter((user) => audience === "MY_GROUP" ? user.groupId === currentGroupId : user.groupId === targetId) : users;
  const panel = <div ref={panelRef} className="fixed w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-ink/10 bg-white p-4 text-ink shadow-xl" style={{ top: panelPosition.top, right: panelPosition.right, zIndex: 2147483647 }}>
      <div className="flex items-center justify-between gap-3"><h2 className="font-serif text-xl">Notifications</h2><button type="button" className="text-xs font-semibold text-coral hover:underline" onClick={() => void clearUnread()}>Clear new</button></div>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{items.length ? items.map((item) => <div key={item.id} className={`rounded-xl border p-3 ${item.readAt ? "border-ink/10" : "border-coral/40 bg-coral/5"}`}><button type="button" className="block w-full text-left" onClick={() => void markRead(item)}><div className="flex items-center justify-between gap-2"><p className="font-semibold">{item.title}</p><span className="text-[10px] font-bold uppercase tracking-wide text-coral">{item.category}</span></div><p className="mt-1 text-sm text-ink/70">{item.message}</p><p className="mt-1 text-xs text-ink/45">{item.sender?.name ? `From ${item.sender.name} · ` : ""}{new Date(item.createdAt).toLocaleString()}</p></button><button type="button" className="mt-2 text-xs font-semibold text-ink/50 hover:text-coral" onClick={() => void remove(item.id)}>Delete</button></div>) : <p className="py-4 text-sm text-ink/55">No notifications.</p>}{hasMore && <button type="button" className="w-full rounded border px-3 py-2 text-xs font-semibold" onClick={() => void load(nextBefore)}>Load older</button>}</div>
      {canSend && <details className="mt-4 border-t border-ink/10 pt-3"><summary className="cursor-pointer text-sm font-semibold">Send notification</summary><div className="mt-3 grid gap-2"><input className="rounded border p-2 text-sm" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} /><textarea className="rounded border p-2 text-sm" placeholder="Message" value={message} onChange={(event) => setMessage(event.target.value)} /><input className="rounded border p-2 text-sm" placeholder="Link (optional, e.g. /admin/reports)" value={link} onChange={(event) => setLink(event.target.value)} /><select className="rounded border p-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}><option value="GENERAL">General</option><option value="REPORT">Report</option><option value="EVENT">Event</option><option value="MEMBERSHIP">Membership</option><option value="SYSTEM">System</option></select><label className="grid gap-1 text-xs font-semibold text-ink/60">Audience<select className="rounded border p-2 text-sm font-normal text-ink" value={audience} onChange={(event) => { setAudience(event.target.value); setTargetId(""); }}><option value="ADMINS">Administrators</option><option value="MY_GROUP">My security group</option>{groups.length > 0 && <option value="GROUP">A specific security group</option>}{users.length > 0 && <option value="USER">A specific user</option>}{groups.length > 0 && <option value="GLOBAL">Everyone, including linked members</option>}</select></label>{audience === "GROUP" && <label className="grid gap-1 text-xs font-semibold text-ink/60">Security group<select className="rounded border p-2 text-sm font-normal text-ink" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose a group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}{audience === "USER" && <label className="grid gap-1 text-xs font-semibold text-ink/60">User<select className="rounded border p-2 text-sm font-normal text-ink" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose a user</option>{audienceUsers.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}</select></label>}<button type="button" className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white" onClick={() => void send()}>Send</button>{feedback && <p className="text-xs text-ink/60">{feedback}</p>}</div></details>}
    </div>;
  return <div className="relative">
    <button ref={buttonRef} type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="focus-ring relative rounded-full p-2 text-ink/70 hover:bg-mist hover:text-coral" onClick={() => { if (!open) updatePanelPosition(); setOpen((current) => !current); if (!open) void load(); }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-2"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-coral px-1 text-center text-[10px] font-bold leading-5 text-white">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && mounted && createPortal(panel, document.body)}
  </div>;
}
