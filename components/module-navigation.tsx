"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminNavIcon } from "./admin-nav-icon";

type ModuleLink = { slug: string; name: string; href: string; permission: string };

function moduleIcon(slug: string) {
  if (slug === "membership") return "membership" as const;
  if (slug === "events") return "events" as const;
  if (slug === "accounting") return "accounting" as const;
  if (slug === "giving") return "giving" as const;
  if (slug === "services") return "services" as const;
  return "site" as const;
}

export function ModuleNavigation({ onNavigate }: { onNavigate?: () => void } = {}) {
  const [modules, setModules] = useState<ModuleLink[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    const loadModules = () => fetch("/api/modules").then((response) => response.ok ? response.json() : null).then((value) => {
      if (value?.modules) setModules(value.modules);
    }).catch(() => undefined);
    void loadModules();
    window.addEventListener("site-settings-updated", loadModules);
    return () => window.removeEventListener("site-settings-updated", loadModules);
  }, []);

  if (!modules.length) return null;
  const linkClass = "focus-ring rounded-lg px-3 py-2 text-sm hover:bg-mist";
  const groupClass = "ml-4 grid gap-1 border-l border-ink/10 pl-2";
  return <>{modules.filter((module) => module.slug !== "public-site").map((module) => {
    if (module.slug === "membership") return <details key={module.slug} open={pathname.startsWith("/admin/membership")} className="group"><summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist"><AdminNavIcon name="membership" />{module.name}<span className="ml-auto text-ink/50 group-open:rotate-180">⌄</span></summary><div className={groupClass}><Link onClick={onNavigate} className={linkClass} href={module.href}>Directory</Link><Link onClick={onNavigate} className={linkClass} href="/admin/membership/prayer-requests">Prayer Requests</Link><Link onClick={onNavigate} className={linkClass} href="/admin/membership/workflows">Workflows</Link><Link onClick={onNavigate} className={linkClass} href="/admin/membership/messaging">Messaging</Link><Link onClick={onNavigate} className={linkClass} href="/admin/membership/audiences">Groups</Link><Link onClick={onNavigate} className={linkClass} href="/admin/membership/custom-fields">Custom Fields</Link><Link onClick={onNavigate} className={linkClass} href="/admin/membership/reports">Reports</Link><Link onClick={onNavigate} className={linkClass} href="/admin/membership/settings">Settings</Link></div></details>;
    if (module.slug === "events") return <details key={module.slug} open={pathname.startsWith("/admin/events")} className="group"><summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist"><AdminNavIcon name="events" />{module.name}<span className="ml-auto text-ink/50 group-open:rotate-180">⌄</span></summary><div className={groupClass}><Link onClick={onNavigate} className={linkClass} href="/admin/events">Events</Link><Link onClick={onNavigate} className={linkClass} href="/admin/events/attendance">Attendance</Link><Link onClick={onNavigate} className={linkClass} href="/admin/events/volunteer-scheduling">Volunteer Scheduling</Link><Link onClick={onNavigate} className={linkClass} href="/admin/events/notification-templates">Notification Templates</Link><Link onClick={onNavigate} className={linkClass} href="/admin/events/reports">Reports</Link><Link onClick={onNavigate} className={linkClass} href="/admin/events/settings">Settings</Link></div></details>;
    if (module.slug === "accounting") return <details key={module.slug} open={pathname.startsWith("/admin/accounting")} className="group"><summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist"><AdminNavIcon name="accounting" />{module.name}<span className="ml-auto text-ink/50 group-open:rotate-180">⌄</span></summary><div className={groupClass}><Link onClick={onNavigate} className={linkClass} href="/admin/accounting">Dashboard</Link><Link onClick={onNavigate} className={linkClass} href="/admin/accounting/budget">Budget</Link><Link onClick={onNavigate} className={linkClass} href="/admin/accounting/chart-of-accounts">Chart of Accounts</Link><Link onClick={onNavigate} className={linkClass} href="/admin/accounting/funds">Funds</Link><Link onClick={onNavigate} className={linkClass} href="/admin/accounting/register">Register</Link><Link onClick={onNavigate} className={linkClass} href="/admin/accounting/contacts">Contacts</Link><Link onClick={onNavigate} className={linkClass} href="/admin/accounting/reports">Reports</Link><Link onClick={onNavigate} className={linkClass} href="/admin/accounting/settings">Settings</Link></div></details>;
    if (module.slug === "giving") return <details key={module.slug} open={pathname.startsWith("/admin/giving")} className="group"><summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist"><AdminNavIcon name="giving" />{module.name}<span className="ml-auto text-ink/50 group-open:rotate-180">⌄</span></summary><div className={groupClass}><Link onClick={onNavigate} className={linkClass} href={module.href}>Contributions</Link><Link onClick={onNavigate} className={linkClass} href="/admin/giving/pledges">Pledges</Link><Link onClick={onNavigate} className={linkClass} href="/admin/giving/reports">Reports</Link><Link onClick={onNavigate} className={linkClass} href="/admin/giving/categories">Categories</Link><Link onClick={onNavigate} className={linkClass} href="/admin/giving/online-giving">Online Giving</Link></div></details>;
    return <Link onClick={onNavigate} key={module.slug} className="focus-ring flex items-center gap-3 rounded-lg px-4 py-3 font-semibold hover:bg-mist" href={module.href}><AdminNavIcon name={moduleIcon(module.slug)} />{module.name}</Link>;
  })}</>;
}
