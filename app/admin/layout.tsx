"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "@/components/ui";
import { ModuleNavigation } from "@/components/module-navigation";
import { AdminLogout } from "@/components/admin-logout";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [identity, setIdentity] = useState({ siteLogoUrl: "", siteShowLogo: false });
  const [publicSiteEnabled, setPublicSiteEnabled] = useState(true);
  const isEditor = pathname === "/admin/editor" || pathname.startsWith("/admin/editor/");
  const [editorChromeVisible, setEditorChromeVisible] = useState(true);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    void fetch("/api/site-identity").then(async (response) => {
      if (!response.ok) return;
      const value = await response.json();
      setIdentity({ siteLogoUrl: value.siteLogoLightUrl ?? value.siteLogoUrl ?? "", siteShowLogo: value.siteShowLogo ?? false });
    });
    void fetch("/api/modules").then(async (response) => {
      if (!response.ok) return;
      const value = await response.json();
      setPublicSiteEnabled(value.publicSiteEnabled !== false);
    });
  }, [pathname]);

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
              <Link href="/admin" className="focus-ring font-serif text-xl font-bold">Site administration</Link>
              <p className="text-xs text-ink/55">Management workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isEditor && <button type="button" aria-label="Hide admin bar" aria-expanded={editorChromeVisible} className="focus-ring rounded-full border border-ink/15 px-3 py-2 text-xs font-semibold text-ink/70 transition-colors duration-200 hover:border-coral hover:text-coral" onClick={() => setEditorChromeVisible(false)}>Hide admin bar</button>}
            {publicSiteEnabled && <Link className="focus-ring text-sm font-medium text-ink/60 hover:text-coral" href="/">View site</Link>}
          </div>
        </Container>
      </header>
      <div className={`flex w-full flex-col lg:flex-row ${isEditor ? "min-h-0 flex-1" : ""}`}>
        <aside className={`max-h-[2000px] overflow-hidden border-b border-ink/10 bg-white transition-[max-height,max-width,opacity,transform,width] duration-300 ease-out lg:max-w-72 lg:shrink-0 lg:border-b-0 lg:border-r ${isEditor ? "lg:min-h-0 lg:overflow-y-auto" : "lg:min-h-[calc(100vh-5rem)]"} ${isEditor && !editorChromeVisible ? "pointer-events-none max-h-0 -translate-x-2 opacity-0 lg:w-0 lg:max-w-0" : "translate-x-0 opacity-100 lg:w-72"}`}>
          <nav aria-label="Admin navigation" className="grid gap-1 p-4 sm:p-6">
            <Link className="focus-ring rounded-lg bg-mist px-4 py-3 font-semibold hover:bg-coral hover:text-white" href="/admin">Admin Dashboard</Link>
            {publicSiteEnabled && <details open={pathname.startsWith("/admin/pages")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Pages <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages">Pages</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages/add">Add a Page</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages/widgets">Widgets</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/forms">Forms</Link>
              </div>
            </details>}
            {publicSiteEnabled && <Link className={`focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist ${pathname.startsWith("/admin/media") ? "bg-mist text-coral" : ""}`} href="/admin/media">Media Library</Link>}
            <details open={pathname.startsWith("/admin/security")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Security <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/security">Security Groups</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/security/settings">Settings</Link>
              </div>
            </details>
            <details open={pathname.startsWith("/admin/users")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Users <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/users/add">Add User</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/users">Edit Users</Link>
              </div>
            </details>
            {publicSiteEnabled && <details open={pathname.startsWith("/admin/navigation")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Navigation <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/navigation">Menus</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/navigation/locations">Locations</Link>
              </div>
            </details>}
            {publicSiteEnabled && <details open={pathname.startsWith("/admin/theme")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Theme</summary>
              <div className="ml-3 grid gap-1 border-l border-ink/10 pl-3">
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/theme">Visual theme</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/theme/header">Header</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/theme/footer">Footer</Link>
              </div>
            </details>}
            <details open={pathname.startsWith("/admin/site-settings") || pathname.startsWith("/admin/site-identity")} className="group">
              <summary className="focus-ring cursor-pointer list-none rounded-lg px-4 py-3 font-semibold hover:bg-mist">Site Settings <span className="float-right text-ink/50 group-open:rotate-180">⌄</span></summary>
              <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
                {publicSiteEnabled && <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/site-identity">Site Identity</Link>}
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/site-settings">General Settings</Link>
                <Link className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/site-settings/messaging">Messaging</Link>
              </div>
            </details>
            <ModuleNavigation />
            {publicSiteEnabled && <Link className="focus-ring rounded-lg px-4 py-3 font-semibold hover:bg-mist" href="/">View site</Link>}
            <AdminLogout />
          </nav>
        </aside>
        <div className={`min-h-0 min-w-0 flex-1 ${isEditor ? "overflow-hidden" : ""} ${isEditor && !editorChromeVisible ? "admin-editor-shell-expanded" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
