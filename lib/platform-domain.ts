import { db } from "@/lib/db";
import { isPlatformHost, normalizeRequestHost } from "@/lib/platform-host";
import { unstable_cache } from "next/cache";

const findPublicTenant = unstable_cache(async (hostname: string) => {
  const churchSelect = { id: true, slug: true, name: true, status: true, publicSiteEnabled: true, maintenanceMode: true, subscriptions: { where: { status: "ACTIVE" as const }, select: { id: true }, take: 1 } } as const;
  const custom = await db.siteDomain.findFirst({ where: { hostname, kind: "CUSTOM_DOMAIN", status: "ACTIVE" }, select: { church: { select: churchSelect } } });
  if (custom?.church?.status === "ACTIVE") return custom.church;
  const platform = await db.siteDomain.findFirst({ where: { hostname, kind: "PLATFORM_SUBDOMAIN", status: "ACTIVE" }, select: { church: { select: churchSelect } } });
  return platform?.church?.status === "ACTIVE" ? platform.church : null;
}, ["public-tenant-by-host"], { revalidate: 60 });

export async function resolvePublicTenant(hostValue: string | null | undefined) {
  const hostname = normalizeRequestHost(hostValue);
  if (!hostname || isPlatformHost(hostname)) return null;
  return findPublicTenant(hostname);
}

export function domainDnsGuidance(hostname: string, registrarProvider: string | null) {
  return `Point ${hostname} to the platform target using your ${registrarProvider || "domain registrar"} DNS controls, then run verification. The site remains unverified until DNS and TLS checks succeed.`;
}
