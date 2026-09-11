"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { MenuLinks } from "@/components/menu-links";

type MenuItem = { id: string; label: string; href: string; position: number; parentId: string | null; openInNewTab: boolean };

export function ResponsivePublicNav({ items, authenticated }: { items: MenuItem[]; authenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fallback = <><Link className="focus-ring hover:text-coral" href="#gather">Gather</Link><Link className="focus-ring hover:text-coral" href="#belong">Belong</Link></>;
  return <>
    <button type="button" aria-controls="public-navigation" aria-expanded={open} className="focus-ring rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold lg:hidden" onClick={() => setOpen((current) => !current)}>{open ? "Close" : "Menu"}</button>
    <div id="public-navigation" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }} className={`${open ? "block" : "hidden"} absolute left-0 right-0 top-20 border-b border-ink/10 bg-sand p-5 lg:static lg:block lg:min-w-0 lg:flex-1 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0`}>
      <nav aria-label="Primary navigation" className="site-primary-nav text-sm font-medium lg:flex lg:flex-nowrap lg:items-center lg:justify-end lg:gap-5 lg:whitespace-nowrap">
        {items.length ? <MenuLinks items={items} className="grid gap-4 lg:flex lg:flex-nowrap lg:shrink-0 lg:items-center lg:gap-5" /> : <div className="flex flex-col gap-4 lg:flex-row lg:flex-nowrap lg:items-center">{fallback}</div>}
        {authenticated ? <><Link className="focus-ring mt-4 block shrink-0 font-medium hover:text-coral lg:mt-0" href="/directory">Directory</Link><Link className="focus-ring mt-4 block shrink-0 font-medium hover:text-coral lg:mt-0" href="/account">Account</Link><div className="relative z-50 mt-4 shrink-0 lg:mt-0"><button type="button" aria-expanded={membershipOpen} aria-controls="member-navigation" className="focus-ring font-medium hover:text-coral" onClick={() => setMembershipOpen((current) => !current)}>My membership <span aria-hidden="true">{membershipOpen ? "⌃" : "⌄"}</span></button>{membershipOpen && mounted && createPortal(<div id="member-navigation" className="fixed right-6 top-20 z-[100] grid min-w-56 gap-2 rounded-xl border border-ink/10 bg-white p-3 text-ink shadow-lg">{[["/account/membership", "Member center"], ["/account/membership/profile", "Member profile"], ["/account/membership/prayer-requests", "Prayer requests"], ["/account/membership/scheduling", "Scheduling"], ["/account/membership/giving", "Online giving"], ["/account/membership/giving-history", "Giving history and pledges"], ["/account/membership/documents", "Documents and forms"]].map(([href, label]) => <Link key={href} className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href={href}>{label}</Link>)}</div>, document.body)}</div><button type="button" className="focus-ring mt-4 shrink-0 text-left font-medium text-ink/70 hover:text-coral lg:mt-0" onClick={() => signOut({ callbackUrl: "/" })}>Logout</button></> : <Link className="focus-ring mt-4 block shrink-0 font-medium hover:text-coral lg:mt-0" href="/register">Join</Link>}
      </nav>
    </div>
  </>;
}
