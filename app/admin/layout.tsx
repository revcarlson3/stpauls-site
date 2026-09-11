"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "@/components/ui";
import { ModuleNavigation } from "@/components/module-navigation";
import { AdminLogout } from "@/components/admin-logout";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [identity, setIdentity] = useState({ siteName: "Site administration", siteTagline: "Management workspace", siteLogoUrl: "", siteShowLogo: false });
  const [publicSiteEnabled, setPublicSiteEnabled] = useState(true);
  const [membershipLinked, setMembershipLinked] = useState(false);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [isAdministrator, setIsAdministrator] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [viewAsGroups, setViewAsGroups] = useState<{ id: string; name: string }[]>([]);
  const [viewAsGroupId, setViewAsGroupId] = useState("");
  const [membershipMenuOpen, setMembershipMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isEditor = pathname === "/admin/editor" || pathname.startsWith("/admin/editor/");
  const [editorChromeVisible, setEditorChromeVisible] = useState(true);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    const loadIdentity = () => {
      void Promise.all([fetch("/api/site-settings"), fetch("/api/site-identity")]).then(async ([settingsResponse, identityResponse]) => {
        if (!settingsResponse.ok) return;
        const settings = await settingsResponse.json();
        const identity = identityResponse.ok ? await identityResponse.json() : {};
        setIdentity({ siteName: settings.siteName ?? "Site administration", siteTagline: settings.siteTagline ?? "Management workspace", siteLogoUrl: identity.siteLogoLightUrl ?? identity.siteLogoUrl ?? "", siteShowLogo: identity.siteShowLogo ?? false });
      });
    };
    loadIdentity();
    window.addEventListener("site-settings-updated", loadIdentity);
    return () => window.removeEventListener("site-settings-updated", loadIdentity);
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    void fetch("/api/account").then(async (response) => {
      if (!response.ok) return;
      const value = await response.json();
      setCanAccessAdmin(value.canAccessAdmin === true);
      setIsAdministrator(value.isAdministrator === true);
      setPermissions(value.permissions ?? []);
    }).catch(() => undefined);
    void fetch("/api/modules").then(async (response) => {
      if (!response.ok) {
        setPublicSiteEnabled(false);
        return;
      }

      const can = (permission: string) => permissions.includes(permission);
      const value = await response.json();
      setPublicSiteEnabled(value.publicSiteEnabled !== false);
    });
    void fetch("/api/account/membership").then(async (response) => {
      if (!response.ok) return;
      const value = await response.json();
      setMembershipLinked(value.linked === true);
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
      window.location.reload();
    }
  }

  const can = (permission: string) => permissions.includes(permission);

  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-sand">{children}</div>;
  }

  return (
    <div className={`admin-shell ${isEditor ? "flex h-screen flex-col overflow-hidden" : "min-h-screen"} bg-sand`}>
      {isEditor && <button type="button" aria-label="Show admin bar" aria-expanded={editorChromeVisible} className={`focus-ring fixed left-4 top-4 z-50 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-lg transition-[opacity,transform] duration-300 ease-out hover:bg-coral ${editorChromeVisible ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`} onClick={() => setEditorChromeVisible(true)}>Show admin bar</button>}
      <header className={`overflow-hidden border-b border-ink/10 bg-white transition-[max-height,opacity,transform] duration-300 ease-out ${isEditor && !editorChromeVisible ? "pointer-events-none max-h-0 -translate-y-2 opacity-0" : "max-h-40 translate-y-0 opacity-100"}`}>
        <Container className="flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            {identity.siteShowLogo && identity.siteLogoUrl && <img src={identity.siteLogoUrl} alt="" className="h-10 w-auto object-contain" />}
            <div>
              <Link href={canAccessAdmin ? "/admin" : membershipLinked ? "/account/membership" : "/account"} className="focus-ring font-serif text-xl font-bold">{identity.siteName}</Link>
              <p className="text-xs text-ink/55">{identity.siteTagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isEditor && <button type="button" aria-label="Hide admin bar" aria-expanded={editorChromeVisible} className="focus-ring rounded-full border border-ink/15 px-3 py-2 text-xs font-semibold text-ink/70 transition-colors duration-200 hover:border-coral hover:text-coral" onClick={() => setEditorChromeVisible(false)}>Hide admin bar</button>}
            {isAdministrator && viewAsGroups.length > 0 && <label className="flex items-center gap-2 text-xs font-semibold text-ink/60"><span className="sr-only">View as security group</span><select aria-label="View as security group" value={viewAsGroupId} onChange={(event) => void changeViewAs(event.target.value)} className="focus-ring rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-xs font-semibold text-ink"><option value="">View as: Administrator</option>{viewAsGroups.map((group) => <option key={group.id} value={group.id}>View as: {group.name}</option>)}</select>{viewAsGroupId && <button type="button" className="focus-ring text-xs font-semibold text-coral hover:underline" onClick={() => void changeViewAs("")}>Clear</button>}</label>}
            <Link className="focus-ring text-sm font-medium text-ink/60 hover:text-coral" href="/account">Account</Link>
            {membershipLinked && <div className="relative"><button type="button" aria-expanded={membershipMenuOpen} aria-controls="admin-member-navigation" className="focus-ring rounded-full border border-coral px-3 py-2 text-sm font-semibold text-coral hover:bg-coral hover:text-white" onClick={() => setMembershipMenuOpen((current) => !current)}>My membership <span aria-hidden="true">{membershipMenuOpen ? "⌃" : "⌄"}</span></button>{membershipMenuOpen && mounted && createPortal(<div id="admin-member-navigation" className="fixed right-6 top-20 z-[100] grid min-w-56 gap-1 rounded-xl border border-ink/10 bg-white p-2 text-ink shadow-lg"><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership">Member center</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/profile">Member profile</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/prayer-requests">Prayer requests</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/scheduling">Scheduling</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/giving">Online giving</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/giving-history">Giving history and pledges</Link><Link className="focus-ring rounded-lg px-3 py-2 text-sm text-ink hover:bg-mist" href="/account/membership/documents">Documents and forms</Link></div>, document.body)}</div>}
            {publicSiteEnabled && <Link className="focus-ring text-sm font-medium text-ink/60 hover:text-coral" href="/">View site</Link>}
          </div>
        </Container>
      </header>
      <div className={`flex w-full flex-col lg:flex-row ${isEditor ? "min-h-0 flex-1" : ""}`}>
        {!canAccessAdmin ? <div className="min-h-[calc(100vh-5rem)] flex-1">{pathname.startsWith("/admin") ? <Container className="py-16"><h1 className="font-serif text-3xl">Administration access required</h1><p className="mt-3 text-sm text-ink/60">This account can manage its Account page, but does not have access to Site Administration.</p></Container> : children}</div> : <>
        <aside className={`max-h-[2000px] overflow-hidden border-b border-ink/10 bg-white transition-[max-height,max-width,opacity,transform,width] duration-300 ease-out lg:max-w-72 lg:shrink-0 lg:border-b-0 lg:border-r ${isEditor ? "lg:min-h-0 lg:overflow-y-auto" : "lg:min-h-[calc(100vh-5rem)]"} ${isEditor && !editorChromeVisible ? "pointer-events-none max-h-0 -translate-x-2 opacity-0 lg:w-0 lg:max-w-0" : "translate-x-0 opacity-100 lg:w-72"}`}>
          <nav aria-label="Admin navigation" className="grid gap-1 p-4 sm:p-6">
            <Link className="focus-ring rounded-lg bg-mist px-4 py-3 font-semibold hover:bg-coral hover:text-white" href="/admin">Admin Dashboard</Link>
            {publicSiteEnabled && can("EDIT_PAGES") && <details open={pathname.startsWith("/admin/pages")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Pages <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages">Pages</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages/add">Add a Page</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages/widgets">Widgets</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/forms">Forms</Link>
              </div>
            </details>}
            {publicSiteEnabled && can("EDIT_PAGES") && <Link className={`focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist ${pathname.startsWith("/admin/media") ? "bg-mist text-coral" : ""}`} href="/admin/media">Media Library</Link>}
            {can("MANAGE_USERS") && <details open={pathname.startsWith("/admin/security")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Security <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/security">Security Groups</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/security/settings">Settings</Link>
              </div>
            </details>}
            {can("MANAGE_USERS") && <details open={pathname.startsWith("/admin/users")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Users <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/users/add">Add User</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/users">Edit Users</Link>
              </div>
            </details>}
            {publicSiteEnabled && can("MANAGE_MENUS") && <details open={pathname.startsWith("/admin/navigation")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Navigation <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/navigation">Menus</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/navigation/locations">Locations</Link>
              </div>
            </details>}
            {publicSiteEnabled && can("MANAGE_SETTINGS") && <details open={pathname.startsWith("/admin/theme")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Theme</summary>
              <div className="ml-3 grid gap-1 border-l border-ink/10 pl-3">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/theme">Visual theme</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/theme/header">Header</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/theme/footer">Footer</Link>
              </div>
            </details>}
            {can("MANAGE_SETTINGS") && <details open={pathname.startsWith("/admin/site-settings") || pathname.startsWith("/admin/site-identity")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Site Settings <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                {publicSiteEnabled && <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/site-identity">Site Identity</Link>}
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/site-settings">General Settings</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/site-settings/messaging">Messaging</Link>
              </div>
            </details>}
            <ModuleNavigation />
            {publicSiteEnabled && <Link className="focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist" href="/">View site</Link>}
            <AdminLogout />
          </nav>
        </aside>
        <div className={`min-h-0 min-w-0 flex-1 ${isEditor ? "overflow-hidden" : ""} ${isEditor && !editorChromeVisible ? "admin-editor-shell-expanded" : ""}`}>{children}</div>
        </>}
      </div>
    </div>
  );
}
