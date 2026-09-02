import type { Permission } from "@prisma/client";
import { db } from "@/lib/db";

export const MODULES = [
  { slug: "membership", name: "Membership", permission: "MANAGE_MEMBERSHIP" as Permission, href: "/admin/membership" },
  { slug: "events", name: "Events and scheduling", permission: "MANAGE_EVENTS" as Permission, href: "/admin/events" },
  { slug: "giving", name: "Giving and pledges", permission: "MANAGE_GIVING" as Permission, href: "/admin/giving" },
  { slug: "accounting", name: "Accounting and budget", permission: "MANAGE_ACCOUNTING" as Permission, href: "/admin/accounting" },
  { slug: "services", name: "Services and sermons", permission: "MANAGE_SERVICES" as Permission, href: "/admin/services" }
] as const;

export async function getEnabledModuleSlugs() {
  const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { enabledModules: true } });
  const enabled = settings?.enabledModules;
  return Array.isArray(enabled) ? enabled.filter((slug): slug is string => typeof slug === "string") : [];
}

export async function getAvailableModules(userId: string) {
  const [enabledSlugs, user] = await Promise.all([
    getEnabledModuleSlugs(),
    db.user.findUnique({ where: { id: userId }, select: { group: { select: { permissions: { select: { permission: true } } } } } })
  ]);
  const permissions = new Set(user?.group?.permissions.map(({ permission }) => permission));
  return MODULES.filter((module) => enabledSlugs.includes(module.slug) && permissions.has(module.permission));
}

export async function requireEnabledModule(slug: string, userId: string, permission: Permission) {
  const moduleDefinition = MODULES.find((entry) => entry.slug === slug);
  if (!moduleDefinition || moduleDefinition.permission !== permission) throw new Error("Unknown module.");
  const [enabledSlugs, available] = await Promise.all([getEnabledModuleSlugs(), getAvailableModules(userId)]);
  if (!enabledSlugs.includes(slug) || !available.some((entry) => entry.slug === slug)) throw new Error("Module is unavailable.");
}

export function normalizeModuleSlugs(value: unknown) {
  if (!Array.isArray(value)) return null;
  const known = new Set<string>(MODULES.map((module) => module.slug));
  const slugs = value.filter((slug): slug is string => typeof slug === "string" && known.has(slug));
  return Array.from(new Set(slugs));
}
