"use client";

import { useEffect, useState } from "react";
import { dismissAnnouncementForSession, isAnnouncementDismissedForSession } from "@/lib/announcement-session";

type Announcement = { id: string; title: string; body: string; severity: string; acknowledged: boolean };

function severityClasses(severity: string) {
  if (severity === "SUCCESS") return "border-emerald-300 bg-emerald-100 text-emerald-950";
  if (severity === "WARNING") return "border-amber-300 bg-amber-100 text-amber-950";
  if (severity === "CRITICAL") return "border-red-300 bg-red-100 text-red-950";
  return "border-sky-300 bg-sky-100 text-sky-950";
}

export function AnnouncementTicker({ publicOnly = false }: { publicOnly?: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  useEffect(() => {
    let active = true;
    void fetch(`/api/announcements${publicOnly ? "?surface=public" : ""}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { announcements: [] })
      .then((value) => { if (active) setItems((value.announcements ?? []).filter((item: Announcement) => !isAnnouncementDismissedForSession(item.id))); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [publicOnly]);
  if (!items.length) return null;
  async function acknowledge(id: string) {
    dismissAnnouncementForSession(id);
    await fetch(`/api/announcements/${id}/acknowledge`, { method: "POST" }).catch(() => undefined);
    setItems((current) => current.filter((item) => item.id !== id));
  }
  const barClasses = severityClasses(items[0].severity);
  return <div className={`w-full border-b text-base sm:text-lg ${barClasses}`}><div className="announcement-ticker relative w-full overflow-hidden py-3 pr-14 sm:py-4"><div className="announcement-ticker-track flex w-max items-center gap-5 px-4 sm:px-6 lg:px-8">{items.map((item) => <div key={item.id} className="flex shrink-0 items-center gap-3 px-4 py-2"><strong className="shrink-0">{item.title}</strong><span>{item.body}</span></div>)}</div>{!publicOnly && <div className={`absolute inset-y-0 right-0 z-10 flex items-center border-l border-black/10 px-3 shadow-[-8px_0_16px_rgba(0,0,0,0.08)] sm:px-5 ${barClasses}`}>{items.filter((item) => !item.acknowledged).map((item) => <button key={item.id} type="button" aria-label={`Dismiss ${item.title}`} title="Dismiss" className="focus-ring grid h-9 w-9 place-items-center rounded-full text-2xl leading-none opacity-70 hover:bg-black/10 hover:opacity-100" onClick={() => void acknowledge(item.id)}>×</button>)}</div>}</div></div>;
}
