import crypto from "node:crypto";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { requirePermission } from "@/lib/auth";
import { checkNamecheapDomainAvailability, createNamecheapRegistration, createNamecheapTransfer, getNamecheapTransferStatus } from "@/lib/namecheap";
import { normalizeHostname } from "@/lib/global-admin-domains";

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

export function tenantDomainWhere(churchId: string) {
  return { churchId };
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function response(request: { id: string; hostname: string; operation: string; status: string; externalId: string | null; externalStatus: string | null }) {
  return { id: request.id, hostname: request.hostname, operation: request.operation, status: request.status, externalId: request.externalId, externalStatus: request.externalStatus };
}

export async function searchDomainAvailability(domains: string[]) {
  const results = await checkNamecheapDomainAvailability(domains);
  const actor = await requirePermission("MANAGE_SETTINGS");
  await logAudit({ activityType: "domain-availability-searched", summary: "Searched domain availability.", actorId: actor.id, details: JSON.stringify({ count: results.length }) });
  return results;
}

export async function createTenantDomain(input: { hostname: string; kind: "PLATFORM_SUBDOMAIN" | "CUSTOM_DOMAIN" }) {
  const actor = await requirePermission("MANAGE_SETTINGS");
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
      verificationToken: crypto.randomBytes(24).toString("hex"),
      tlsStatus: "PENDING",
      dnsGuidance: input.kind === "CUSTOM_DOMAIN" ? "Add the verification DNS record, then retry verification. 1Panel attachment and SSL remain separate pending steps." : "Platform hostname is reserved locally. 1Panel attachment and DNS/SSL provisioning remain pending."
    },
    select: { id: true, hostname: true, kind: true, status: true, tlsStatus: true, dnsGuidance: true }
  });
  await logAudit({ activityType: "domain-acquisition-requested", summary: `Added ${input.kind === "CUSTOM_DOMAIN" ? "external" : "platform"} domain ${hostname}.`, actorId: actor.id, details: JSON.stringify({ domainId: domain.id, kind: input.kind, provisioning: "PENDING_1PANEL_ATTACHMENT" }) });
  return domain;
}

export async function listTenantDomains() {
  const actor = await requirePermission("MANAGE_SETTINGS");
  if (!actor.churchId) throw new Error("A tenant site is required.");
  return db.siteDomain.findMany({
    where: tenantDomainWhere(actor.churchId),
    orderBy: { createdAt: "asc" },
    select: {
      id: true, hostname: true, kind: true, status: true, isPrimary: true,
      verifiedAt: true, tlsStatus: true, dnsManaged: true, lastCheckedAt: true,
      lastError: true, dnsGuidance: true
    }
  });
}

export async function requestDomainAcquisition(input: { hostname: string; operation: "REGISTRATION" | "TRANSFER"; idempotencyKey: string }) {
  const actor = await requirePermission("MANAGE_SETTINGS");
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
