"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui";
import { AdminNavigation } from "@/components/admin-navigation";
import { NotificationBell } from "@/components/notification-bell";
import { AnnouncementTicker } from "@/components/announcement-ticker";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [publicSiteUrl, setPublicSiteUrl] = useState<string | null>(null);
  const [publicWebsiteModuleEnabled, setPublicWebsiteModuleEnabled] = useState(false);
  const [membershipLinked, setMembershipLinked] = useState(false);
  const [onlineGivingEnabled, setOnlineGivingEnabled] = useState(false);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [isAdministrator, setIsAdministrator] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [viewAsGroups, setViewAsGroups] = useState<{ id: string; name: string; canAccessAdmin: boolean }[]>([]);
  const [viewAsGroupId, setViewAsGroupId] = useState("");
  const [membershipMenuOpen, setMembershipMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const membershipButtonRef = useRef<HTMLButtonElement>(null);
  const isEditor = pathname === "/admin/editor" || pathname.startsWith("/admin/editor/");
  const [editorChromeVisible, setEditorChromeVisible] = useState(true);
  const publicSiteBridgeUrl = publicSiteUrl ? `/api/auth/public-site-bridge?target=${encodeURIComponent(publicSiteUrl)}` : null;
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const refreshOnlineGiving = () => {
      void fetch("/api/giving/online-giving", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((value) =>
          setOnlineGivingEnabled(
            value?.enabled === true && value?.tithelyEnvironment === "live",
          ),
        )
        .catch(() => undefined);
    };
    window.addEventListener("online-giving-settings-updated", refreshOnlineGiving);
    return () =>
      window.removeEventListener("online-giving-settings-updated", refreshOnlineGiving);
  }, []);
  useEffect(() => {
    if (!membershipMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (membershipButtonRef.current?.contains(target) || (target instanceof Element && target.closest("#admin-member-navigation"))) return;
      setMembershipMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMembershipMenuOpen(false); };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutsideClick); document.removeEventListener("keydown", closeOnEscape); };
  }, [membershipMenuOpen]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    void fetch("/api/account").then(async (response) => {
      if (!response.ok) return;
      const value = await response.json();
      setCanAccessAdmin(value.canAccessAdmin === true);
      setIsAdministrator(value.isAdministrator === true);
      setPermissions(value.permissions ?? []);
      setIsPlatformAdmin(value.isPlatformAdmin === true);
      setSubscriptionActive(value.subscriptionActive === true);
      setPublicSiteUrl(typeof value.publicSiteUrl === "string" ? value.publicSiteUrl : null);
    }).catch(() => undefined);
    void fetch("/api/modules").then(async (response) => {
      if (!response.ok) return;

      const value = await response.json();
      setPublicWebsiteModuleEnabled(Array.isArray(value.modules) && value.modules.some((module: { slug?: string }) => module.slug === "public-site"));
    });
    void fetch("/api/account/membership").then(async (response) => {
      if (!response.ok) return;
      const value = await response.json();
      setMembershipLinked(value.linked === true);
    }).catch(() => undefined);
    void fetch("/api/giving/online-giving", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const value = await response.json();
      setOnlineGivingEnabled(
        value.enabled === true && value.tithelyEnvironment === "live",
      );
    }).catch(() => undefined);
    void fetch("/api/view-as").then(async (response) => {
      if (!response.ok) return;
      const value = await response.json();
      setViewAsGroups(value.groups ?? []);
      setViewAsGroupId(value.activeGroupId ?? "");
    }).catch(() => undefined);
  }, [pathname]);

  async function changeViewAs(groupId: string) {
    const response = await fetch("/api/view-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId }) });
    if (response.ok) {
      setViewAsGroupId(groupId);
      if (!groupId) {
        window.location.href = pathname.startsWith("/admin") ? pathname : "/admin";
        return;
      }
      const selectedGroup = viewAsGroups.find((group) => group.id === groupId);
      window.location.href = selectedGroup?.canAccessAdmin ? window.location.href : pathname === "/admin/membership/prayer-requests" ? "/account/membership/prayer-requests" : "/account/membership";
    }
  }

  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-sand">{children}</div>;
  }

  return (
    <div className={`admin-shell ${isEditor ? "flex h-screen flex-col overflow-hidden" : "min-h-screen"} bg-sand`}>
      {isEditor && <button type="button" aria-label="Show admin bar" aria-expanded={editorChromeVisible} className={`focus-ring fixed left-4 top-4 z-50 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-lg transition-[opacity,transform] duration-300 ease-out hover:bg-coral ${editorChromeVisible ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`} onClick={() => setEditorChromeVisible(true)}>Show admin bar</button>}
      <header className={`overflow-hidden border-b border-ink/10 bg-white transition-[max-height,opacity,transform] duration-300 ease-out ${isEditor && !editorChromeVisible ? "pointer-events-none max-h-0 -translate-y-2 opacity-0" : "max-h-40 translate-y-0 opacity-100"}`}>
        <Container className="flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <Link href={canAccessAdmin ? "/admin" : membershipLinked ? "/account/membership" : "/account"} className="focus-ring rounded-lg"><Image src="/mychurch-one-logo.svg" alt="mychurch.one" width={168} height={56} className="h-14 w-auto object-contain" /></Link>
          </div>
          <div className="flex items-center gap-4">
            {isEditor && <button type="button" aria-label="Hide admin bar" aria-expanded={editorChromeVisible} className="focus-ring rounded-full border border-ink/15 px-3 py-2 text-xs font-semibold text-ink/70 transition-colors duration-200 hover:border-coral hover:text-coral" onClick={() => setEditorChromeVisible(false)}>Hide admin bar</button>}
            {isAdministrator && viewAsGroups.length > 0 && <label className="flex items-center gap-2 text-xs font-semibold text-ink/60"><span className="sr-only">View as security group</span><select aria-label="View as security group" value={viewAsGroupId} onChange={(event) => void changeViewAs(event.target.value)} className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-xs font-semibold text-ink"><option value="">View as: Administrator</option>{viewAsGroups.map((group) => <option key={group.id} value={group.id}>View as: {group.name}</option>)}</select>{viewAsGroupId && <button type="button" className="focus-ring text-xs font-semibold text-coral hover:underline" onClick={() => void changeViewAs("")}>Clear</button>}</label>}
            <Link className="focus-ring text-sm font-medium text-ink/60 hover:text-coral" href="/account">Account</Link>
            {isPlatformAdmin && <Link className="focus-ring text-sm font-medium text-ink/60 hover:text-coral" href="/admin/support">Support management</Link>}
            {!isPlatformAdmin && permissions.includes("CREATE_SUPPORT_TICKETS") && <Link className="focus-ring text-sm font-medium text-ink/60 hover:text-coral" href="/account/support">Support</Link>}
            <NotificationBell />
            {membershipLinked && <div className="relative"><button ref={membershipButtonRef} type="button" aria-expanded={membershipMenuOpen} aria-controls="admin-member-navigation" className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral hover:bg-coral hover:text-white" onClick={() => setMembershipMenuOpen((current) => !current)}>My membership <span aria-hidden="true">{membershipMenuOpen ? "⌃" : "⌄"}</span></button>{membershipMenuOpen && mounted && createPortal(<div id="admin-member-navigation" className="fixed right-6 top-20 z-[100] grid min-w-56 gap-1 rounded-xl border border-ink/10 bg-white p-2 text-ink shadow-lg"><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership">Member center</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/profile">Member profile</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/prayer-requests">Prayer requests</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/scheduling">Scheduling</Link>{onlineGivingEnabled && <Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/giving">Online giving</Link>}<Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/giving-history">Giving history and pledges</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/documents">Documents and forms</Link></div>, document.body)}</div>}
            {publicSiteBridgeUrl && <a className="focus-ring text-sm font-medium text-ink/60 hover:text-coral" href={publicSiteBridgeUrl} target="_blank" rel="noopener noreferrer">View site</a>}
          </div>
        </Container>
      </header>
      {!isEditor && pathname !== "/admin/login" && <AnnouncementTicker />}
      <div className={`flex w-full flex-col lg:flex-row ${isEditor ? "min-h-0 flex-1" : ""}`}>
        {!canAccessAdmin ? <div className="min-h-[calc(100vh-5rem)] flex-1">{pathname.startsWith("/admin") ? <Container className="py-16"><h1 className="font-serif text-3xl">Administration access required</h1><p className="mt-3 text-sm text-ink/60">This account can manage its Account page, but does not have access to Site Administration.</p></Container> : children}</div> : <>
        <aside className={`max-h-[2000px] overflow-hidden border-b border-ink/10 bg-white transition-[max-height,max-width,opacity,transform,width] duration-300 ease-out lg:max-w-72 lg:shrink-0 lg:border-b-0 lg:border-r ${isEditor ? "lg:min-h-0 lg:overflow-y-auto" : "lg:min-h-[calc(100vh-5rem)]"} ${isEditor && !editorChromeVisible ? "pointer-events-none max-h-0 -translate-x-2 opacity-0 lg:w-0 lg:max-w-0" : "translate-x-0 opacity-100 lg:w-72"}`}>
          <AdminNavigation permissions={permissions} publicWebsiteModuleEnabled={publicWebsiteModuleEnabled} subscriptionActive={subscriptionActive} />
        </aside>
        <div className={`min-h-0 min-w-0 flex-1 ${isEditor ? "overflow-hidden" : ""} ${isEditor && !editorChromeVisible ? "admin-editor-shell-expanded" : ""}`}>{!subscriptionActive && !pathname.startsWith("/admin/billing") && !pathname.startsWith("/admin/domains") ? <Container className="py-16"><h1 className="font-serif text-3xl">Subscription required</h1><p className="mt-3 max-w-xl text-sm text-ink/60">Billing and Domains remain available while you set up a subscription. Other site administration features become available after the subscription is active.</p><Link className="focus-ring mt-5 inline-block rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white" href="/admin/billing">Set up subscription</Link></Container> : children}</div>
        </>}
      </div>
    </div>
  );
}
