"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { clearAnnouncementSession } from "@/lib/announcement-session";
import { ModuleNavigation } from "@/components/module-navigation";

export function AdminDrawer() {
  const [open, setOpen] = useState(false);
  const [publicSiteEnabled, setPublicSiteEnabled] = useState(true);
  const [launcherPosition, setLauncherPosition] = useState({ x: 0, y: 80 });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(() => pathname.startsWith("/admin/security") ? "security" : pathname.startsWith("/admin/navigation") ? "navigation" : pathname.startsWith("/admin/site-settings") || pathname.startsWith("/admin/site-identity") ? "site-settings" : pathname.startsWith("/admin/theme") ? "theme" : null);
  const toggle = (section: string) => setExpanded((current) => current === section ? null : section);

  useEffect(() => {
    void fetch("/api/modules").then((response) => response.ok ? response.json() : null).then((value) => {
      setPublicSiteEnabled(value?.publicSiteEnabled !== false);
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
        <nav className="mt-8 grid gap-2" aria-label="Authenticated tools">
          <Link href="/admin" className="focus-ring rounded-lg bg-mist px-4 py-3 font-semibold hover:bg-coral hover:text-white" onClick={() => setOpen(false)}>Admin Dashboard</Link>
          {publicSiteEnabled && <><button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("pages")}>Pages <span>⌄</span></button>
          {expanded === "pages" && <div className="ml-4 grid gap-1"><Link href="/admin/pages" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Pages</Link><Link href="/admin/pages/add" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Add a Page</Link></div>}</>}
          <button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("security")}>Security <span>⌄</span></button>
          {expanded === "security" && <div className="ml-4 grid gap-1"><Link href="/admin/security" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Security Groups</Link><Link href="/admin/security/settings" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Settings</Link></div>}
          <button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("users")}>Users <span>⌄</span></button>
          {expanded === "users" && <div className="ml-4 grid gap-1"><Link href="/admin/users/add" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Add User</Link><Link href="/admin/users" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Edit Users</Link></div>}
          {publicSiteEnabled && <><button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("navigation")}>Navigation <span>⌄</span></button>
          {expanded === "navigation" && <div className="ml-4 grid gap-1"><Link href="/admin/navigation" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Menus</Link><Link href="/admin/navigation/locations" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Locations</Link></div>}
          <button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("theme")}>Theme <span>⌄</span></button>
          {expanded === "theme" && <div className="ml-4 grid gap-1"><Link href="/admin/theme" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Visual theme</Link><Link href="/admin/theme/header" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Header</Link><Link href="/admin/theme/footer" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Footer</Link></div>}</>}
          <button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("site-settings")}>Site Settings <span>⌄</span></button>
          {expanded === "site-settings" && <div className="ml-4 grid gap-1"><Link href="/admin/site-identity" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Site Identity</Link><Link href="/admin/site-settings" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>General Settings</Link><Link href="/admin/site-settings/messaging" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Messaging</Link></div>}
          <ModuleNavigation />
          <button type="button" className="focus-ring rounded-lg px-4 py-3 text-left font-semibold text-coral hover:bg-sand" onClick={() => { clearAnnouncementSession(); void signOut({ callbackUrl: "/" }); }}>Logout</button>
        </nav>
        <p className="absolute bottom-6 left-6 right-6 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/50">This menu is visible only to authenticated users. Access is still enforced by the server.</p>
      </aside>
    </>
  );
}
