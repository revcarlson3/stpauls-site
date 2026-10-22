"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminLogout } from "@/components/admin-logout";
import { AdminNavIcon } from "@/components/admin-nav-icon";
import { ModuleNavigation } from "@/components/module-navigation";

type AdminNavigationProps = {
  permissions: string[];
  publicWebsiteModuleEnabled: boolean;
  subscriptionActive: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function AdminNavigation({ permissions, publicWebsiteModuleEnabled, subscriptionActive, onNavigate, className = "grid gap-1 p-4 sm:p-6" }: AdminNavigationProps) {
  const pathname = usePathname();
  const can = (permission: string) => permissions.includes(permission);

  return (
    <nav aria-label="Admin navigation" className={className}>
      {subscriptionActive && <Link onClick={onNavigate} className="focus-ring flex items-center gap-3 rounded-lg bg-mist px-4 py-3 font-semibold hover:bg-coral hover:text-white" href="/admin"><AdminNavIcon name="dashboard" />Admin Dashboard</Link>}
      <p className="mt-4 border-t border-ink/10 px-4 pt-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Site administration</p>
      {subscriptionActive && publicWebsiteModuleEnabled && (can("PUBLISH_PAGES") || can("MANAGE_SETTINGS")) && <details open={pathname.startsWith("/admin/pages") || pathname.startsWith("/admin/media") || pathname.startsWith("/admin/navigation") || pathname.startsWith("/admin/theme") || pathname.startsWith("/admin/website-settings") || pathname.startsWith("/admin/announcements") || pathname.startsWith("/admin/site-settings/announcements")} className="group">
        <summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist"><AdminNavIcon name="pages" />Public Website <span className="ml-auto text-ink/50 group-open:rotate-180">⌄</span></summary>
        <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
          {can("EDIT_PAGES") && <><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages">Pages</Link><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages/add">Add a Page</Link><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/media">Media Library</Link></>}
          {can("MANAGE_MENUS") && <><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/navigation">Navigation / Menus</Link><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/navigation/locations">Locations</Link></>}
          {can("MANAGE_SETTINGS") && <><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/website-settings">Website Settings</Link><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/theme">Theme</Link><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/theme/header">Header</Link><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/theme/footer">Footer</Link></>}
          {can("EDIT_PAGES") && <><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/pages/widgets">Widgets</Link><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/forms">Forms</Link></>}
          {can("MANAGE_SETTINGS") && <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/announcements">Announcements</Link>}
        </div>
      </details>}
      {subscriptionActive && can("MANAGE_USERS") && <details open={pathname.startsWith("/admin/security")} className="group">
        <summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist"><AdminNavIcon name="security" />Security <span className="ml-auto text-ink/50 group-open:rotate-180">⌄</span></summary>
        <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
          <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/security">Security Groups</Link>
          <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/security/settings">Settings</Link>
        </div>
      </details>}
      {subscriptionActive && can("MANAGE_USERS") && <details open={pathname.startsWith("/admin/users")} className="group">
        <summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist"><AdminNavIcon name="users" />Users <span className="ml-auto text-ink/50 group-open:rotate-180">⌄</span></summary>
        <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
          <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/users/add">Add User</Link>
          <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/users">Edit Users</Link>
        </div>
      </details>}
      {subscriptionActive && can("MANAGE_SETTINGS") && <details open={pathname.startsWith("/admin/site-settings") || pathname.startsWith("/admin/site-identity")} className="group">
        <summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist"><AdminNavIcon name="settings" />Site Settings <span className="ml-auto text-ink/50 group-open:rotate-180">⌄</span></summary>
        <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
          <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/site-identity">Site Identity</Link>
          <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/site-settings">General Settings</Link>
          <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/site-settings/messaging">Messaging</Link>
        </div>
      </details>}
      {!subscriptionActive && <Link onClick={onNavigate} className="focus-ring flex items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist" href="/admin/billing"><AdminNavIcon name="settings" />Billing</Link>}
      {subscriptionActive && can("MANAGE_SETTINGS") && <details open={pathname.startsWith("/admin/billing") || pathname.startsWith("/admin/domains")} className="group">
        <summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist"><AdminNavIcon name="settings" />Billing and Domains <span className="ml-auto text-ink/50 group-open:rotate-180">⌄</span></summary>
        <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2">
          <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/billing">Billing</Link>
          <Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/domains">Domains</Link>
        </div>
      </details>}
      {subscriptionActive && <><p className="mt-4 border-t border-ink/10 px-4 pt-4 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Modules</p><ModuleNavigation onNavigate={onNavigate} />{can("ACCESS_ADMIN") && <div className="ml-4 grid gap-1 border-l border-ink/10 pl-2"><Link onClick={onNavigate} className="focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist" href="/admin/report-automations">Report Automations</Link></div>}</>}
      <AdminLogout onLogout={onNavigate} />
    </nav>
  );
}
