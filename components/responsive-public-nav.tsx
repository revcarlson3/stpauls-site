"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { clearAnnouncementSession } from "@/lib/announcement-session";
import { MenuLinks } from "@/components/menu-links";
import { NotificationBell } from "@/components/notification-bell";

type MenuItem = { id: string; label: string; href: string; position: number; parentId: string | null; openInNewTab: boolean };
type AuthenticatedNavProps = {
  authenticated: boolean;
  menuId: string | null;
  isMainNavigation: boolean;
  accountMenuIds: string[];
  membershipMenuIds: string[];
  logoutMenuIds: string[];
  notificationMenuIds: string[];
  compact?: boolean;
};

function shouldShow(menuId: string | null, configuredMenuIds: string[], isMainNavigation: boolean) {
  return configuredMenuIds.length ? (menuId ? configuredMenuIds.includes(menuId) : false) : isMainNavigation;
}

export function AuthenticatedPublicNav({ authenticated, menuId, isMainNavigation, accountMenuIds, membershipMenuIds, logoutMenuIds, notificationMenuIds, compact = false }: AuthenticatedNavProps) {
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [onlineGivingEnabled, setOnlineGivingEnabled] = useState(false);
  const showAccount = authenticated && shouldShow(menuId, accountMenuIds, isMainNavigation);
  const showMembership = authenticated && shouldShow(menuId, membershipMenuIds, isMainNavigation);
  const showLogout = authenticated && shouldShow(menuId, logoutMenuIds, isMainNavigation);
  const showNotification = authenticated && shouldShow(menuId, notificationMenuIds, isMainNavigation);

  useEffect(() => {
    if (!authenticated || !showMembership) return;
    const loadOnlineGiving = () =>
      fetch("/api/giving/online-giving", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((value) => setOnlineGivingEnabled(value?.enabled === true && value?.tithelyEnvironment === "live"))
        .catch(() => undefined);
    void loadOnlineGiving();
    window.addEventListener("online-giving-settings-updated", loadOnlineGiving);
    return () => window.removeEventListener("online-giving-settings-updated", loadOnlineGiving);
  }, [authenticated, showMembership]);

  if (!showAccount && !showMembership && !showLogout && !showNotification) return null;
  const spacing = compact ? "" : "mt-4 lg:mt-0";
  return <>{showAccount && <Link className={`focus-ring block shrink-0 font-medium hover:text-coral ${spacing}`} href="/account">Account</Link>}{showMembership && <div className={`relative z-[200] shrink-0 ${spacing}`} onMouseEnter={() => setMembershipOpen(true)} onMouseLeave={() => setMembershipOpen(false)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMembershipOpen(false); }}><button type="button" aria-expanded={membershipOpen} aria-controls="member-navigation" className="focus-ring rounded-lg py-2 font-medium hover:text-coral" onFocus={() => setMembershipOpen(true)}>My membership <span aria-hidden="true" className="ml-1 text-sm text-ink/60">{membershipOpen ? "⌃" : "⌄"}</span></button><div id="member-navigation" onFocus={() => setMembershipOpen(true)} className={`${membershipOpen ? "visible pointer-events-auto opacity-100 translate-y-0" : "invisible pointer-events-none opacity-0 translate-y-1"} absolute right-0 top-full z-[300] w-72 pt-3 transition-[opacity,transform] duration-150 lg:block`}><div className="grid gap-1.5 rounded-xl border border-ink/10 bg-white p-3 text-base text-ink shadow-xl ring-1 ring-black/5"><Link className="focus-ring rounded-lg px-4 py-3 leading-snug hover:bg-mist hover:text-coral" href="/account/membership">Member center</Link><Link className="focus-ring rounded-lg px-4 py-3 leading-snug hover:bg-mist hover:text-coral" href="/account/membership/profile">Member profile</Link><Link className="focus-ring rounded-lg px-4 py-3 leading-snug hover:bg-mist hover:text-coral" href="/account/membership/prayer-requests">Prayer requests</Link><Link className="focus-ring rounded-lg px-4 py-3 leading-snug hover:bg-mist hover:text-coral" href="/account/membership/scheduling">Scheduling</Link>{onlineGivingEnabled && <Link className="focus-ring rounded-lg px-4 py-3 leading-snug hover:bg-mist hover:text-coral" href="/account/membership/giving">Online giving</Link>}<Link className="focus-ring rounded-lg px-4 py-3 leading-snug hover:bg-mist hover:text-coral" href="/account/membership/giving-history">Giving history and pledges</Link><Link className="focus-ring rounded-lg px-4 py-3 leading-snug hover:bg-mist hover:text-coral" href="/account/membership/documents">Documents and forms</Link></div></div></div>}{showLogout && <button type="button" className={`focus-ring shrink-0 text-left font-medium text-ink/70 hover:text-coral ${spacing}`} onClick={() => { clearAnnouncementSession(); void signOut({ callbackUrl: "/" }); }}>Logout</button>}{showNotification && <div className={`shrink-0 ${spacing}`}><NotificationBell /></div>}</>;
}

export function ResponsivePublicNav({ items, authenticated, menuId, accountMenuIds, membershipMenuIds, logoutMenuIds, notificationMenuIds }: { items: MenuItem[]; authenticated: boolean; menuId: string | null; accountMenuIds: string[]; membershipMenuIds: string[]; logoutMenuIds: string[]; notificationMenuIds: string[] }) {
  const fallback = <><Link className="focus-ring hover:text-coral" href="#gather">Gather</Link><Link className="focus-ring hover:text-coral" href="#belong">Belong</Link></>;
  return <>
    <div id="public-navigation" className="hidden lg:block lg:min-w-0 lg:flex-1 lg:overflow-visible">
      <nav aria-label="Primary navigation" className="site-primary-nav text-base font-medium lg:flex lg:flex-nowrap lg:items-center lg:justify-end lg:gap-8 lg:whitespace-nowrap">
        {items.length ? <MenuLinks items={items} className="grid gap-4 lg:flex lg:flex-nowrap lg:shrink-0 lg:items-center lg:gap-8" /> : <div className="flex flex-col gap-4 lg:flex-row lg:flex-nowrap lg:items-center">{fallback}</div>}
        {authenticated ? <AuthenticatedPublicNav authenticated={authenticated} menuId={menuId} isMainNavigation accountMenuIds={accountMenuIds} membershipMenuIds={membershipMenuIds} logoutMenuIds={logoutMenuIds} notificationMenuIds={notificationMenuIds} /> : <Link className="focus-ring mt-4 block shrink-0 font-medium hover:text-coral lg:mt-0" href="/register">Join</Link>}
      </nav>
    </div>
  </>;
}
