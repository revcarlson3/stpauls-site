import { randomBytes } from "crypto";
import type { DomainKind, DomainStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";
import { provisionPlatformDns } from "@/lib/namecheap";
import { domainDnsGuidance } from "@/lib/platform-domain";

const HOSTNAME_MAX_LENGTH = 253;
const HOST_LABEL = /^(?!-)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
export const DEFAULT_PLATFORM_DOMAIN_SUFFIX = "mychurch.one";

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

export function buildPlatformHostname(slug: string, suffix = process.env.PLATFORM_DOMAIN_SUFFIX ?? DEFAULT_PLATFORM_DOMAIN_SUFFIX, uniqueLabel = "0000") {
  const base = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "church";
  const normalizedSuffix = normalizeHostname(suffix);
  if (!normalizedSuffix) throw new Error("The platform domain suffix is invalid.");
  return `${base}-${uniqueLabel}.${normalizedSuffix}`;
}

export function primaryDomainIsSelectable(domain: { status: DomainStatus; churchId: string }, selectedChurchId: string) {
  return domain.churchId === selectedChurchId && domain.status === "ACTIVE";
}

export function isSelectedSiteDomain(domainChurchId: string, selectedChurchId: string) {
  return domainChurchId === selectedChurchId;
}

export function serializeDomain(domain: {
  id: string;
  hostname: string;
  kind: DomainKind;
  status: DomainStatus;
  isPrimary: boolean;
  verifiedAt: Date | null;
  tlsStatus: string | null;
  dnsManaged: boolean;
  lastCheckedAt: Date | null;
  lastError: string | null;
  registrarProvider?: string | null;
  registrarDetectedAt?: Date | null;
  dnsGuidance?: string | null;
}) {
  return {
    id: domain.id,
    hostname: domain.hostname,
    kind: domain.kind,
    status: domain.status,
    isPrimary: domain.isPrimary,
    verifiedAt: domain.verifiedAt?.toISOString() ?? null,
    tlsStatus: domain.tlsStatus,
    dnsManaged: domain.dnsManaged,
    lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
    registrarProvider: domain.registrarProvider ?? null,
    registrarDetectedAt: domain.registrarDetectedAt?.toISOString() ?? null,
    dnsGuidance: domain.dnsGuidance ?? null,
    statusMessage: domain.kind === "PLATFORM_SUBDOMAIN"
      ? "Platform-managed hostname. DNS and TLS are managed by the platform."
      : domain.verifiedAt ? "Domain verification completed." : "Add the required DNS record and complete TLS verification manually."
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

export async function lookupRegistrar(hostname: string) {
  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(hostname)}`, { headers: { Accept: "application/rdap+json" } });
    if (response.ok) {
      const body = await response.json() as { entities?: Array<{ roles?: string[]; vcardArray?: unknown[] }> };
      const registrar = body.entities?.find((entity) => entity.roles?.includes("registrar"));
      const text = JSON.stringify(registrar ?? "").toLowerCase();
      return { provider: text.includes("namecheap") ? "Namecheap" : text ? "RDAP registrar" : null, guidance: domainDnsGuidance(hostname, text.includes("namecheap") ? "Namecheap" : "your registrar") };
    }
  } catch { /* External lookup is advisory; the domain remains unverified. */ }
  return { provider: null, guidance: domainDnsGuidance(hostname, null) };
}

async function requireMutableSelectedChurch() {
  const context = await requireGlobalAdmin({ selectedChurch: true, sensitive: true });
  const church = await db.church.findUnique({ where: { id: context.church!.id }, select: { id: true, name: true, slug: true, lifecycleStatus: true } });
  if (!church) throw new Error("Selected site is unavailable.");
  if (church.lifecycleStatus === "DISABLED" || church.lifecycleStatus === "CANCELED" || church.lifecycleStatus === "SUSPENDED") throw new Error("Selected site lifecycle does not allow this change.");
  return { context, church };
}

export async function listSelectedChurchDomains() {
  const context = await requireGlobalAdmin({ selectedChurch: true });
  const domains = await db.siteDomain.findMany({
    where: { churchId: context.church!.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true, registrarProvider: true, registrarDetectedAt: true, dnsGuidance: true }
  });
  return domains.map(serializeDomain);
}

export async function addSelectedChurchDomain(input: { hostname?: unknown; kind: unknown }) {
  const { context, church } = await requireMutableSelectedChurch();
  if (!isDomainKind(input.kind)) throw new Error("Provide a valid hostname and domain kind.");
  let hostname = normalizeHostname(input.hostname);
  let platformSuffix = "0000";
  if (input.kind === "PLATFORM_SUBDOMAIN") {
    if (input.hostname) throw new Error("Platform subdomains are generated by the platform.");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      platformSuffix = randomBytes(2).toString("hex");
      hostname = buildPlatformHostname(church.slug, undefined, platformSuffix);
      const existing = await db.siteDomain.findUnique({ where: { hostname }, select: { id: true } });
      if (!existing) break;
      hostname = null;
    }
    if (!hostname) throw new Error("Unable to generate an available platform hostname.");
  }
  if (!hostname) throw new Error("Provide a valid custom hostname.");
  const isPlatform = input.kind === "PLATFORM_SUBDOMAIN";
  const provisioning = isPlatform ? await provisionPlatformDns(hostname) : null;
  if (provisioning?.state !== "PROVISIONED") throw new Error(provisioning?.guidance ?? "Platform DNS provisioning is unavailable.");
  const registrar = isPlatform ? { provider: "Namecheap", guidance: "Platform DNS was provisioned through Namecheap." } : await lookupRegistrar(hostname);
  const now = new Date();
  const domain = await db.siteDomain.create({
    data: {
      churchId: church.id,
      hostname,
      kind: input.kind,
      status: isPlatform ? "ACTIVE" : "PENDING",
      isPrimary: false,
      verificationToken: isPlatform ? null : randomBytes(24).toString("hex"),
      verifiedAt: isPlatform ? now : null,
      tlsStatus: isPlatform ? "MANAGED" : "MANUAL_VERIFICATION_REQUIRED",
      dnsManaged: isPlatform,
      lastCheckedAt: isPlatform ? now : null,
      registrarProvider: registrar.provider,
      registrarDetectedAt: isPlatform ? now : new Date(),
      dnsGuidance: registrar.guidance
    },
    select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true }
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message.includes("Unique constraint")) throw new Error("That hostname is already registered.");
    throw error;
  });
  await db.auditLog.create({
    data: {
      activityType: "global-admin-domain-added",
      summary: `Added ${hostname} to the selected site.`,
      actorId: context.user.id,
      details: buildGlobalAuditDetails({ churchId: church.id, targetType: "site-domain", targetId: domain.id, metadata: { hostname, kind: input.kind, provisioning: provisioning?.state ?? "registrar-lookup" } })
    }

  });
  return serializeDomain(domain);
}

export async function enableSelectedChurchDomain(domainId: string) {
  const { context, church } = await requireMutableSelectedChurch();
  const domain = await db.siteDomain.findFirst({ where: { id: domainId, churchId: church.id }, select: { id: true, hostname: true, kind: true } });
  if (!domain) throw new Error("Domain was not found for the selected site.");
  if (domain.kind === "PLATFORM_SUBDOMAIN") {
    const provisioning = await provisionPlatformDns(domain.hostname);
    if (provisioning.state !== "PROVISIONED") throw new Error(provisioning.guidance);
  }
  const updated = await db.siteDomain.update({ where: { id: domain.id }, data: { status: domain.kind === "PLATFORM_SUBDOMAIN" ? "ACTIVE" : "PENDING", isPrimary: false }, select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  await db.auditLog.create({ data: { activityType: "global-admin-domain-dns-provisioned", summary: `Enabled ${domain.hostname}.`, actorId: context.user.id, details: buildGlobalAuditDetails({ churchId: church.id, targetType: "site-domain", targetId: domain.id, metadata: { action: "enable" } }) } });
  return serializeDomain(updated);
}

export async function deleteSelectedChurchDomain(domainId: string) {
  const { context, church } = await requireMutableSelectedChurch();
  const domain = await db.siteDomain.findFirst({ where: { id: domainId, churchId: church.id }, select: { id: true, hostname: true } });
  if (!domain) throw new Error("Domain was not found for the selected site.");
  await db.siteDomain.delete({ where: { id: domain.id } });
  await db.auditLog.create({ data: { activityType: "global-admin-domain-disabled", summary: `Deleted ${domain.hostname}.`, actorId: context.user.id, details: buildGlobalAuditDetails({ churchId: church.id, targetType: "site-domain", targetId: domain.id, metadata: { action: "delete" } }) } });
  return { id: domain.id, deleted: true };
}

export async function disableSelectedChurchDomain(domainId: string) {
  const { context, church } = await requireMutableSelectedChurch();
  const domain = await db.siteDomain.findFirst({ where: { id: domainId, churchId: church.id }, select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  if (!domain) throw new Error("Domain was not found for the selected site.");
  const updated = await db.siteDomain.update({ where: { id: domain.id }, data: { status: "DISABLED", isPrimary: false, verificationToken: null }, select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  await db.auditLog.create({
    data: {
      activityType: "global-admin-domain-disabled",
      summary: `Disabled ${domain.hostname} for the selected site.`,
      actorId: context.user.id,
      details: buildGlobalAuditDetails({ churchId: church.id, targetType: "site-domain", targetId: domain.id, metadata: { hostname: domain.hostname } })
    }
  });
  return serializeDomain(updated);
}

export async function checkSelectedChurchDomain(domainId: string) {
  const { context, church } = await requireMutableSelectedChurch();
  const domain = await db.siteDomain.findFirst({ where: { id: domainId, churchId: church.id }, select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  if (!domain) throw new Error("Domain was not found for the selected site.");
  if (domain.kind === "PLATFORM_SUBDOMAIN") return serializeDomain(domain);
  const checked = manualDomainStatus();
  const updated = await db.siteDomain.update({ where: { id: domain.id }, data: checked, select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  await db.auditLog.create({
    data: {
      activityType: "global-admin-domain-status-checked",
      summary: `Checked status for ${domain.hostname}.`,
      actorId: context.user.id,
      details: buildGlobalAuditDetails({ churchId: church.id, targetType: "site-domain", targetId: domain.id, metadata: { hostname: domain.hostname, result: "manual-verification-required" } })
    }
  });
  return serializeDomain(updated);
}

export async function selectPrimarySelectedChurchDomain(domainId: string) {
  const { context, church } = await requireMutableSelectedChurch();
  const domain = await db.siteDomain.findFirst({
    where: { id: domainId, churchId: church.id },
    select: { id: true, churchId: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true }
  });
  if (!domain) throw new Error("Domain was not found for the selected site.");
  if (!primaryDomainIsSelectable(domain, church.id)) throw new Error("Only an active domain can be selected as primary.");
  const updated = await db.$transaction(async (transaction) => {
    await transaction.siteDomain.updateMany({ where: { churchId: church.id, isPrimary: true }, data: { isPrimary: false } });
    return transaction.siteDomain.update({ where: { id: domain.id }, data: { isPrimary: true }, select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true } });
  });
  await db.auditLog.create({
    data: {
      activityType: "global-admin-domain-primary-updated",
      summary: `Set ${domain.hostname} as the primary domain for the selected site.`,
      actorId: context.user.id,
      details: buildGlobalAuditDetails({ churchId: church.id, targetType: "site-domain", targetId: domain.id, metadata: { hostname: domain.hostname, action: "set-primary" } })
    }
  });
  return serializeDomain(updated);
}
