"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AdminNavigation } from "@/components/admin-navigation";

export function AdminDrawer() {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [publicWebsiteModuleEnabled, setPublicWebsiteModuleEnabled] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [launcherPosition, setLauncherPosition] = useState({ x: 0, y: 80 });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  useEffect(() => {
    void fetch("/api/account").then((response) => response.ok ? response.json() : null).then((value) => {
      setPermissions(Array.isArray(value?.permissions) ? value.permissions : []);
      setSubscriptionActive(value?.subscriptionActive === true);
    }).catch(() => undefined);
    void fetch("/api/modules").then((response) => response.ok ? response.json() : null).then((value) => {
      setPublicWebsiteModuleEnabled(Array.isArray(value?.modules) && value.modules.some((module: { slug?: string }) => module.slug === "public-site"));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("admin-launcher-position");
      if (saved) {
        const position = JSON.parse(saved) as { x?: unknown; y?: unknown };
        if (typeof position.x === "number" && typeof position.y === "number") setLauncherPosition({ x: position.x, y: position.y });
      }
    } catch {
      // Keep the default position if local storage is unavailable or malformed.
    }
  }, []);

  useEffect(() => {
    const keepInViewport = () => {
      const width = launcherRef.current?.offsetWidth ?? 72;
      const height = launcherRef.current?.offsetHeight ?? 48;
      setLauncherPosition((current) => ({
        x: Math.max(0, Math.min(current.x, window.innerWidth - width)),
        y: Math.max(0, Math.min(current.y, window.innerHeight - height)),
      }));
    };
    window.addEventListener("resize", keepInViewport);
    return () => window.removeEventListener("resize", keepInViewport);
  }, []);

  const saveLauncherPosition = (position: { x: number; y: number }) => {
    setLauncherPosition(position);
    window.localStorage.setItem("admin-launcher-position", JSON.stringify(position));
  };

  const handleLauncherPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = { active: true, moved: false, startX: event.clientX, startY: event.clientY, originX: launcherPosition.x, originY: launcherPosition.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleLauncherPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active) return;
    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) dragRef.current.moved = true;
    if (!dragRef.current.moved) return;
    const width = launcherRef.current?.offsetWidth ?? 72;
    const height = launcherRef.current?.offsetHeight ?? 48;
    saveLauncherPosition({
      x: Math.max(0, Math.min(dragRef.current.originX + deltaX, window.innerWidth - width)),
      y: Math.max(0, Math.min(dragRef.current.originY + deltaY, window.innerHeight - height)),
    });
  };

  const handleLauncherPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <>
      <button
        type="button"
        ref={launcherRef}
        aria-controls="admin-drawer"
        aria-expanded={open}
        className={`focus-ring fixed z-50 block touch-none rounded-full bg-ink px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-lg transition-colors hover:bg-coral ${dragRef.current.active ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ left: launcherPosition.x, top: launcherPosition.y }}
        onPointerDown={handleLauncherPointerDown}
        onPointerMove={handleLauncherPointerMove}
        onPointerUp={handleLauncherPointerUp}
        onClick={() => {
          if (dragRef.current.moved) {
            dragRef.current.moved = false;
            return;
          }
          setOpen((current) => !current);
        }}
      >
        Admin menu
      </button>
      {open && (
        <button
          type="button"
          aria-label="Close admin menu"
          className="fixed inset-0 z-40 cursor-default bg-ink/20"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="admin-drawer"
        aria-label="Administrator menu"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 block w-72 max-w-[calc(100vw-1rem)] bg-white p-6 shadow-2xl transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-coral">Account</p>
            <h2 className="mt-2 font-serif text-2xl">Site tools</h2>
          </div>
          <button type="button" aria-label="Close admin menu" className="focus-ring rounded-full px-2 py-1 text-xl text-ink/60 hover:text-coral" onClick={() => setOpen(false)}>×</button>
        </div>
        <AdminNavigation permissions={permissions} publicWebsiteModuleEnabled={publicWebsiteModuleEnabled} subscriptionActive={subscriptionActive} onNavigate={() => setOpen(false)} className="mt-8 grid gap-2" />
        <p className="absolute bottom-6 left-6 right-6 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/50">This menu is visible only to authenticated users. Access is still enforced by the server.</p>
      </aside>
    </>
  );
}
