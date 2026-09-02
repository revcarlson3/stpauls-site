"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";

export function AdminDrawer() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (section: string) => setExpanded((current) => current === section ? null : section);

  return (
    <>
      <button
        type="button"
        aria-controls="admin-drawer"
        aria-expanded={open}
        className="focus-ring fixed left-0 top-1/2 z-40 -translate-y-1/2 rounded-r-full bg-ink px-3 py-4 text-xs font-semibold uppercase tracking-wider text-white shadow-lg hover:bg-coral"
        onClick={() => setOpen((current) => !current)}
      >
        Admin
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
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white p-6 shadow-2xl transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}
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
          <button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("pages")}>Pages <span>⌄</span></button>
          {expanded === "pages" && <div className="ml-4 grid gap-1"><Link href="/admin/pages" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Pages</Link><Link href="/admin/pages/add" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Add a Page</Link></div>}
          <button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("security")}>Security <span>⌄</span></button>
          {expanded === "security" && <div className="ml-4 grid gap-1"><Link href="/admin/security" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Security Groups</Link><Link href="/admin/security/settings" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Settings</Link></div>}
          <button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("users")}>Users <span>⌄</span></button>
          {expanded === "users" && <div className="ml-4 grid gap-1"><Link href="/admin/users/add" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Add User</Link><Link href="/admin/users" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Edit Users</Link></div>}
          <button type="button" className="focus-ring flex justify-between rounded-lg px-4 py-3 text-left font-semibold hover:bg-mist" onClick={() => toggle("navigation")}>Navigation <span>⌄</span></button>
          {expanded === "navigation" && <div className="ml-4 grid gap-1"><Link href="/admin/navigation" className="focus-ring rounded-lg px-4 py-2 text-sm hover:bg-mist" onClick={() => setOpen(false)}>Menus</Link></div>}
          <Link href="/admin/theme" className="focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist" onClick={() => setOpen(false)}>Theme</Link>
          <Link href="/admin/site-settings" className="focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist" onClick={() => setOpen(false)}>Site Settings</Link>
          <button type="button" className="focus-ring rounded-lg px-4 py-3 text-left font-semibold text-coral hover:bg-sand" onClick={() => signOut({ callbackUrl: "/" })}>Logout</button>
        </nav>
        <p className="absolute bottom-6 left-6 right-6 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/50">This menu is visible only to authenticated users. Access is still enforced by the server.</p>
      </aside>
    </>
  );
}
