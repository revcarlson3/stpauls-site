import crypto from "node:crypto";
import { Resolver, resolveTxt } from "node:dns/promises";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { requirePermission } from "@/lib/auth";
import { checkNamecheapDomainAvailability, createNamecheapRegistration, createNamecheapTransfer, getNamecheapTransferStatus } from "@/lib/namecheap";
import { normalizeHostname } from "@/lib/global-admin-domains";
import { onePanelPlatformTlsStatus, provisionCustomDomainTls } from "@/lib/onepanel";

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

export function tenantDomainWhere(churchId: string) {
  return { churchId };
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildDomainVerificationRecord(hostname: string, token: string | null) {
  if (!token) return null;
  return {
    type: "TXT" as const,
    name: `_mychurch-verification.${hostname}`,
    value: token
  };
}

export function dnsTxtRecordMatches(records: string[][], token: string) {
  return records.some((chunks) => chunks.join("") === token);
}

export function dnsLookupErrorMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code).toUpperCase() : "";
  if (code === "ENOTFOUND" || code === "ENODATA") {
    return "The DNS verification record was not found yet. Add the TXT record and wait for DNS propagation.";
  }
  if (code === "EAI_AGAIN" || code === "ETIMEOUT" || code === "ETIMEDOUT") {
    return "DNS lookup timed out while checking the verification record. Wait a moment and retry.";
  }
  if (code === "SERVFAIL") {
    return "The authoritative DNS servers returned SERVFAIL while checking the verification record. Check DNSSEC and nameserver configuration, then retry.";
  }
  if (code === "REFUSED" || code === "ECONNREFUSED") {
    return "The DNS resolver refused the verification lookup. Check the domain's authoritative nameservers, then retry.";
  }
  return code
    ? `The DNS resolver returned ${code} while checking the verification record.`
    : "The DNS resolver could not complete the verification lookup.";
}

async function resolveVerificationTxt(name: string) {
  const resolvers = [
    async () => resolveTxt(name),
    async () => {
      const resolver = new Resolver();
      resolver.setServers(["1.1.1.1", "8.8.8.8"]);
      return resolver.resolveTxt(name);
    }
  ];
  let lastError: unknown;
  for (const resolve of resolvers) {
    try {
      return await resolve();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function response(request: { id: string; hostname: string; operation: string; status: string; externalId: string | null; externalStatus: string | null }) {
  return { id: request.id, hostname: request.hostname, operation: request.operation, status: request.status, externalId: request.externalId, externalStatus: request.externalStatus };
}

export async function searchDomainAvailability(domains: string[]) {
  const results = await checkNamecheapDomainAvailability(domains);
  const actor = await requirePermission("MANAGE_SETTINGS", { allowUnsubscribed: true });
  await logAudit({ activityType: "domain-availability-searched", summary: "Searched domain availability.", actorId: actor.id, details: JSON.stringify({ count: results.length }) });
  return results;
}

export async function createTenantDomain(input: { hostname: string; kind: "PLATFORM_SUBDOMAIN" | "CUSTOM_DOMAIN" }) {
  const actor = await requirePermission("MANAGE_SETTINGS", { allowUnsubscribed: true });
  if (!actor.churchId) throw new Error("A tenant site is required.");
  const hostname = normalizeHostname(input.hostname);
  if (!hostname) throw new Error("Provide a valid domain.");
  const existing = await db.siteDomain.findFirst({ where: { ...tenantDomainWhere(actor.churchId), hostname }, select: { id: true } });
  if (existing) throw new Error("That hostname is already registered.");
  const domain = await db.siteDomain.create({
    data: {
      churchId: actor.churchId,
      hostname,
      kind: input.kind,
      status: "VERIFYING",
      verificationToken: input.kind === "CUSTOM_DOMAIN" ? crypto.randomBytes(24).toString("hex") : null,
      tlsStatus: input.kind === "CUSTOM_DOMAIN" ? "PENDING" : await onePanelPlatformTlsStatus(),
      dnsGuidance: input.kind === "CUSTOM_DOMAIN" ? "Add the verification DNS record, then retry verification. SSL will be requested automatically after DNS verification." : "Platform hostname uses the mychurch.one wildcard certificate when configured."
    },
    select: { id: true, hostname: true, kind: true, status: true, tlsStatus: true, dnsGuidance: true, verificationToken: true }
  });
  await logAudit({ activityType: "domain-acquisition-requested", summary: `Added ${input.kind === "CUSTOM_DOMAIN" ? "external" : "platform"} domain ${hostname}.`, actorId: actor.id, details: JSON.stringify({ domainId: domain.id, kind: input.kind, provisioning: "PENDING_1PANEL_ATTACHMENT" }) });
  return { ...domain, verificationRecord: domain.kind === "CUSTOM_DOMAIN" ? buildDomainVerificationRecord(domain.hostname, domain.verificationToken) : null };
}

export async function listTenantDomains() {
  const actor = await requirePermission("MANAGE_SETTINGS", { allowUnsubscribed: true });
  if (!actor.churchId) throw new Error("A tenant site is required.");
  return db.siteDomain.findMany({
    where: tenantDomainWhere(actor.churchId),
    orderBy: { createdAt: "asc" },
    select: {
      id: true, hostname: true, kind: true, status: true, isPrimary: true,
      verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true,
      lastError: true, dnsGuidance: true, verificationToken: true
    }
  }).then((domains) => domains.map((domain) => ({ ...domain, verificationRecord: domain.kind === "CUSTOM_DOMAIN" ? buildDomainVerificationRecord(domain.hostname, domain.verificationToken) : null })));
}

export async function verifyTenantDomain(domainId: string) {
  const actor = await requirePermission("MANAGE_SETTINGS", { allowUnsubscribed: true });
  if (!actor.churchId) throw new Error("A tenant site is required.");
  const domain = await db.siteDomain.findFirst({
    where: { id: domainId, ...tenantDomainWhere(actor.churchId) },
    select: { id: true, hostname: true, kind: true, status: true, verificationToken: true }
  });
  if (!domain) throw new Error("The domain was not found for this site.");
  if (domain.kind !== "CUSTOM_DOMAIN") throw new Error("Platform subdomains do not require DNS verification.");
  if (!domain.verificationToken) throw new Error("This domain has no pending DNS verification record.");
  const record = buildDomainVerificationRecord(domain.hostname, domain.verificationToken);
  if (!record) throw new Error("This domain has no pending DNS verification record.");
  let records: string[][];
  try {
    records = await resolveVerificationTxt(record.name);
  } catch (error) {
    throw new Error(dnsLookupErrorMessage(error));
  }

  if (!dnsTxtRecordMatches(records, domain.verificationToken)) throw new Error("The DNS TXT record does not match the verification value shown above.");
  const updated = await db.siteDomain.update({
    where: { id: domain.id },
    data: { status: "ACTIVE", verifiedAt: new Date(), lastCheckedAt: new Date(), lastError: null, verificationToken: null, tlsStatus: "PROVISIONING", dnsGuidance: "DNS verification completed. Let’s Encrypt SSL provisioning is in progress." },
    select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true, dnsGuidance: true, verificationToken: true }
  });
  await logAudit({ activityType: "domain-verification-completed", summary: `Verified external domain ${domain.hostname}.`, actorId: actor.id, details: JSON.stringify({ domainId: domain.id, hostname: domain.hostname }) });
  try {
    const tls = await provisionCustomDomainTls(domain.hostname);
    const provisioned = await db.siteDomain.update({
      where: { id: domain.id },
      data: { tlsStatus: "ACTIVE", tlsCertificateId: tls.certificateId, lastError: null, dnsGuidance: "DNS verification completed and Let’s Encrypt SSL is installed." },
      select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true, dnsGuidance: true, verificationToken: true }
    });
    await logAudit({ activityType: "domain-tls-provisioned", summary: `Installed SSL for external domain ${domain.hostname}.`, actorId: actor.id, details: JSON.stringify({ domainId: domain.id, hostname: domain.hostname, certificateId: tls.certificateId }) });
    return { ...provisioned, verificationRecord: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SSL provisioning failed.";
    const failed = await db.siteDomain.update({
      where: { id: domain.id },
      data: { tlsStatus: "FAILED", lastError: message, dnsGuidance: "DNS verification completed, but SSL provisioning needs attention. Retry after correcting the 1Panel configuration or DNS." },
      select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true, dnsGuidance: true, verificationToken: true }
    });
    await logAudit({ activityType: "domain-tls-provisioning-failed", summary: `SSL provisioning failed for external domain ${domain.hostname}.`, actorId: actor.id, details: JSON.stringify({ domainId: domain.id, hostname: domain.hostname, error: message }) });
    return { ...failed, verificationRecord: null };
  }
}

export async function retryTenantDomainTls(domainId: string) {
  const actor = await requirePermission("MANAGE_SETTINGS", { allowUnsubscribed: true });
  if (!actor.churchId) throw new Error("A tenant site is required.");
  const domain = await db.siteDomain.findFirst({
    where: { id: domainId, churchId: actor.churchId, kind: "CUSTOM_DOMAIN", status: "ACTIVE" },
    select: { id: true, hostname: true }
  });
  if (!domain) throw new Error("The verified custom domain was not found for this site.");
  await db.siteDomain.update({ where: { id: domain.id }, data: { tlsStatus: "PROVISIONING", lastError: null, dnsGuidance: "SSL provisioning is in progress." } });
  try {
    const tls = await provisionCustomDomainTls(domain.hostname);
    const updated = await db.siteDomain.update({
      where: { id: domain.id },
      data: { tlsStatus: "ACTIVE", tlsCertificateId: tls.certificateId, lastError: null, dnsGuidance: "DNS verification completed and Let’s Encrypt SSL is installed." },
      select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true, dnsGuidance: true, verificationToken: true }
    });
    await logAudit({ activityType: "domain-tls-provisioned", summary: `Installed SSL for external domain ${domain.hostname}.`, actorId: actor.id, details: JSON.stringify({ domainId: domain.id, hostname: domain.hostname, certificateId: tls.certificateId, retry: true }) });
    return { ...updated, verificationRecord: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SSL provisioning failed.";
    const updated = await db.siteDomain.update({
      where: { id: domain.id },
      data: { tlsStatus: "FAILED", lastError: message, dnsGuidance: "SSL provisioning failed. Correct the 1Panel configuration or DNS, then retry." },
      select: { id: true, hostname: true, kind: true, status: true, isPrimary: true, verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true, lastError: true, dnsGuidance: true, verificationToken: true }
    });
    await logAudit({ activityType: "domain-tls-provisioning-failed", summary: `SSL provisioning failed for external domain ${domain.hostname}.`, actorId: actor.id, details: JSON.stringify({ domainId: domain.id, hostname: domain.hostname, error: message, retry: true }) });
    return { ...updated, verificationRecord: null };
  }
}

export async function requestDomainAcquisition(input: { hostname: string; operation: "REGISTRATION" | "TRANSFER"; idempotencyKey: string }) {
  const actor = await requirePermission("MANAGE_SETTINGS", { allowUnsubscribed: true });
  if (!actor.churchId) throw new Error("A tenant site is required.");
  const hostname = input.hostname.trim().toLowerCase().replace(/\.+$/, "");
  if (!/^(?!-)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostname)) throw new Error("Provide a valid domain.");
  const existing = await db.siteDomain.findUnique({ where: { hostname }, select: { id: true } });
  if (existing) throw new Error("That hostname is already registered.");
  const duplicate = await db.domainProviderRequest.findUnique({ where: { churchId_operation_idempotencyKey: { churchId: actor.churchId, operation: input.operation, idempotencyKey: input.idempotencyKey } } });
  if (duplicate) return { request: response(duplicate), confirmationToken: null };
  const confirmationToken = crypto.randomBytes(32).toString("base64url");
  const request = await db.domainProviderRequest.create({
    data: { churchId: actor.churchId, requesterId: actor.id, hostname, operation: input.operation, idempotencyKey: input.idempotencyKey, confirmationHash: hash(confirmationToken), expiresAt: new Date(Date.now() + REQUEST_TTL_MS) }
  });
  await logAudit({ activityType: "domain-acquisition-requested", summary: `Requested ${input.operation.toLowerCase()} for ${hostname}.`, actorId: actor.id, details: JSON.stringify({ requestId: request.id, operation: input.operation }) });
  return { request: response(request), confirmationToken };
}

export async function approveDomainAcquisition(input: { requestId: string; confirmationToken: string; years?: number; contacts?: Record<string, string>; nameservers?: string[]; eppCode?: string }) {
  const context = await requireGlobalAdmin({ sensitive: true });
  const request = await db.domainProviderRequest.findUnique({ where: { id: input.requestId } });
  if (!request || request.expiresAt < new Date() || request.status !== "REQUESTED" || !crypto.timingSafeEqual(Buffer.from(request.confirmationHash), Buffer.from(hash(input.confirmationToken)))) throw new Error("The domain approval request is invalid or expired.");
  if (request.operation === "REGISTRATION" && !input.contacts) throw new Error("Registration contacts are required for approval.");
  const result = request.operation === "REGISTRATION"
    ? await createNamecheapRegistration({ hostname: request.hostname, years: input.years ?? 1, contacts: input.contacts!, nameservers: input.nameservers })
    : await createNamecheapTransfer({ hostname: request.hostname, eppCode: input.eppCode ?? "" });
  const externalId = "domainId" in result ? result.domainId : result.transferId;
  const updated = await db.domainProviderRequest.update({ where: { id: request.id }, data: { status: request.operation === "REGISTRATION" ? "SUBMITTED" : "TRANSFER_SUBMITTED", externalId, externalStatus: "status" in result ? result.status : result.registered ? "REGISTERED" : "SUBMITTED", approvedBy: context.user.id, approvedAt: new Date() } });
  await logAudit({ activityType: request.operation === "REGISTRATION" ? "domain-acquisition-approved" : "domain-transfer-initiated", summary: `Approved ${request.operation.toLowerCase()} for ${request.hostname}.`, actorId: context.user.id, details: JSON.stringify({ requestId: request.id, externalId }) });
  return response(updated);
}

export async function pollDomainTransfer(requestId: string) {
  await requireGlobalAdmin();
  const request = await db.domainProviderRequest.findUnique({ where: { id: requestId } });
  if (!request || request.operation !== "TRANSFER" || !request.externalId) throw new Error("Transfer request was not found.");
  const status = await getNamecheapTransferStatus(request.externalId);
  const completed = /completed/i.test(status.status ?? "");
  const updated = await db.domainProviderRequest.update({ where: { id: request.id }, data: { externalStatus: status.status ?? status.statusId, status: completed ? "COMPLETED" : request.status } });
  await logAudit({ activityType: "domain-transfer-status-changed", summary: `Updated transfer status for ${request.hostname}.`, details: JSON.stringify({ requestId, statusId: status.statusId }) });
  return response(updated);
}
