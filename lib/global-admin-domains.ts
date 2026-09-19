import { randomBytes } from "crypto";
import type { DomainKind, DomainStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";

const HOSTNAME_MAX_LENGTH = 253;
const HOST_LABEL = /^(?!-)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function normalizeHostname(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const hostname = input.trim().toLowerCase().replace(/\.+$/, "");
  if (!hostname || hostname.length > HOSTNAME_MAX_LENGTH || hostname.includes("/") || hostname.includes(":") || /\s/.test(hostname)) return null;
  const labels = hostname.split(".");
  if (labels.length < 2 || labels.some((label) => label.length > 63 || !HOST_LABEL.test(label))) return null;
  return hostname;
}

export function isDomainKind(value: unknown): value is DomainKind {
  return value === "PLATFORM_SUBDOMAIN" || value === "CUSTOM_DOMAIN";
}

export function isSelectedSiteDomain(domainChurchId: string, selectedChurchId: string) {
  return domainChurchId === selectedChurchId;
}

export function serializeDomain(domain: {
  id: string;
  hostname: string;
  kind: DomainKind;
  status: DomainStatus;
  verifiedAt: Date | null;
  tlsStatus: string | null;
  dnsManaged: boolean;
  lastCheckedAt: Date | null;
  lastError: string | null;
}) {
  return {
    id: domain.id,
    hostname: domain.hostname,
    kind: domain.kind,
    status: domain.status,
    verifiedAt: domain.verifiedAt?.toISOString() ?? null,
    tlsStatus: domain.tlsStatus,
    dnsManaged: domain.dnsManaged,
    lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
    statusMessage: domain.verifiedAt ? "Domain verification completed." : "Manual DNS and TLS verification is required."
  };
}

export function manualDomainStatus(now = new Date()) {
  return {
    status: "VERIFYING" as const,
    tlsStatus: "MANUAL_VERIFICATION_REQUIRED",
    lastCheckedAt: now,
    lastError: "External DNS/TLS verification is not configured. Add the required DNS record and confirm TLS manually."
  };
}

async function requireMutableSelectedChurch() {
  const context = await requireGlobalAdmin({ selectedChurch: true, sensitive: true });
  const church = await db.church.findUnique({ where: { id: context.church!.id }, select: { id: true, name: true, lifecycleStatus: true } });
  if (!church) throw new Error("Selected site is unavailable.");
  if (church.lifecycleStatus === "DISABLED" || church.lifecycleStatus === "CANCELED" || church.lifecycleStatus === "SUSPENDED") throw new Error("Selected site lifecycle does not allow this change.");
  return { context, church };
}

export async function listSelectedChurchDomains() {
  const context = await requireGlobalAdmin({ selectedChurch: true });
  const domains = await db.siteDomain.findMany({
    where: { churchId: context.church!.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, hostname: true, kind: true, status: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true }
  });
  return domains.map(serializeDomain);
}

export async function addSelectedChurchDomain(input: { hostname: unknown; kind: unknown }) {
  const { context, church } = await requireMutableSelectedChurch();
  const hostname = normalizeHostname(input.hostname);
  if (!hostname || !isDomainKind(input.kind)) throw new Error("Provide a valid hostname and domain kind.");
  const domain = await db.siteDomain.create({
    data: { churchId: church.id, hostname, kind: input.kind, verificationToken: randomBytes(24).toString("hex") },
    select: { id: true, hostname: true, kind: true, status: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true }
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message.includes("Unique constraint")) throw new Error("That hostname is already registered.");
    throw error;
  });
  await db.auditLog.create({
    data: {
      activityType: "global-admin-domain-added",
      summary: `Added ${hostname} to the selected site.`,
      actorId: context.user.id,
      ...JSON.parse(buildGlobalAuditDetails({ churchId: church.id, targetType: "site-domain", targetId: domain.id, metadata: { hostname, kind: input.kind } }))
    }
  });
  return serializeDomain(domain);
}

export async function disableSelectedChurchDomain(domainId: string) {
  const { context, church } = await requireMutableSelectedChurch();
  const domain = await db.siteDomain.findFirst({ where: { id: domainId, churchId: church.id }, select: { id: true, hostname: true, kind: true, status: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  if (!domain) throw new Error("Domain was not found for the selected site.");
  const updated = await db.siteDomain.update({ where: { id: domain.id }, data: { status: "DISABLED", verificationToken: null }, select: { id: true, hostname: true, kind: true, status: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  await db.auditLog.create({
    data: {
      activityType: "global-admin-domain-disabled",
      summary: `Disabled ${domain.hostname} for the selected site.`,
      actorId: context.user.id,
      ...JSON.parse(buildGlobalAuditDetails({ churchId: church.id, targetType: "site-domain", targetId: domain.id, metadata: { hostname: domain.hostname } }))
    }
  });
  return serializeDomain(updated);
}

export async function checkSelectedChurchDomain(domainId: string) {
  const { context, church } = await requireMutableSelectedChurch();
  const domain = await db.siteDomain.findFirst({ where: { id: domainId, churchId: church.id }, select: { id: true, hostname: true, kind: true, status: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  if (!domain) throw new Error("Domain was not found for the selected site.");
  const checked = manualDomainStatus();
  const updated = await db.siteDomain.update({ where: { id: domain.id }, data: checked, select: { id: true, hostname: true, kind: true, status: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  await db.auditLog.create({
    data: {
      activityType: "global-admin-domain-status-checked",
      summary: `Checked status for ${domain.hostname}.`,
      actorId: context.user.id,
      ...JSON.parse(buildGlobalAuditDetails({ churchId: church.id, targetType: "site-domain", targetId: domain.id, metadata: { hostname: domain.hostname, result: "manual-verification-required" } }))
    }
  });
  return serializeDomain(updated);
}
