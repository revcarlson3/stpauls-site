import crypto from "node:crypto";
import { decryptConfig, encryptConfig } from "@/lib/app-config";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";

type NamecheapAttributes = Record<string, string>;

export type NamecheapDnsRecord = {
  host: string;
  type: "A" | "AAAA" | "CNAME" | "TXT";
  address: string;
  ttl: number;
};

export function parseRegistrationDnsRecords(value: unknown): NamecheapDnsRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const item = record as Record<string, unknown>;
    const host = typeof item.host === "string" ? item.host.trim() : "";
    const type = typeof item.type === "string" ? item.type.toUpperCase() : "";
    const address = typeof item.address === "string" ? item.address.trim() : "";
    const ttl = typeof item.ttl === "number" && Number.isInteger(item.ttl) ? item.ttl : Number(item.ttl);
    if (!host || !["A", "AAAA", "CNAME", "TXT"].includes(type) || !address || !Number.isInteger(ttl) || ttl < 60 || ttl > 86400) return [];
    return [{ host, type: type as NamecheapDnsRecord["type"], address, ttl }];
  });
}

function xmlAttributes(value: string): NamecheapAttributes {
  return Object.fromEntries(Array.from(value.matchAll(/([A-Za-z][A-Za-z0-9]*)="([^"]*)"/g)).map(([, key, item]) => [key, item]));
}

function namecheapErrors(body: string) {
  return Array.from(body.matchAll(/<Error\b([^>]*)>([\s\S]*?)<\/Error>/gi)).map((match) => {
    const attributes = xmlAttributes(match[1]);
    return `${attributes.Number ? `[${attributes.Number}] ` : ""}${match[2].replace(/<[^>]+>/g, "").trim()}`;
  });
}

function ensureNamecheapSuccess(body: string) {
  if (!/<ApiResponse\b[^>]*Status="OK"/i.test(body)) {
    throw new Error("Namecheap rejected the request. Verify API permissions and configuration.");
  }
}

async function namecheapRequest(command: string, input: Record<string, string | number | undefined>) {
  const row = await db.namecheapConfiguration.findUnique({ where: { id: "platform" } });
  const apiUser = row?.apiUserEncrypted ? decryptConfig(row.apiUserEncrypted) : process.env.NAMECHEAP_API_USER;
  const apiKey = row?.apiKeyEncrypted ? decryptConfig(row.apiKeyEncrypted) : process.env.NAMECHEAP_API_KEY;
  const username = row?.usernameEncrypted ? decryptConfig(row.usernameEncrypted) : process.env.NAMECHEAP_USERNAME || apiUser;
  const clientIp = row?.clientIp || process.env.NAMECHEAP_CLIENT_IP;
  if (!apiUser || !apiKey || !username || !clientIp) throw new Error("Namecheap API configuration is incomplete.");
  const params = new URLSearchParams({ ApiUser: apiUser, ApiKey: apiKey, UserName: username, ClientIP: clientIp, Command: command });
  for (const [key, value] of Object.entries(input)) if (value !== undefined) params.set(key, String(value));
  const response = await fetch("https://api.namecheap.com/xml.response", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
  const body = await response.text();
  if (!response.ok) throw new Error("Namecheap API request failed.");
  try { ensureNamecheapSuccess(body); } catch {
    const errors = namecheapErrors(body);
    throw new Error(errors.length ? `Namecheap rejected the request: ${errors[0]}` : "Namecheap rejected the request.");
  }
  return body;
}

export type DomainAvailability = {
  domain: string;
  available: boolean;
  premium: boolean;
  registrationPrice: string | null;
};

export function parseDomainAvailability(xml: string): DomainAvailability[] {
  ensureNamecheapSuccess(xml);
  return Array.from(xml.matchAll(/<DomainCheckResult\b([^>]*)\/?>/gi)).map((match) => {
    const attributes = xmlAttributes(match[1]);
    return { domain: attributes.Domain ?? "", available: attributes.Available?.toLowerCase() === "true", premium: attributes.IsPremiumName?.toLowerCase() === "true", registrationPrice: attributes.PremiumRegistrationPrice ?? null };
  }).filter((item) => item.domain);
}

export async function checkNamecheapDomainAvailability(domains: string[]) {
  const normalized = domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean);
  if (!normalized.length || normalized.length > 50) throw new Error("Provide between 1 and 50 domains.");
  const body = await namecheapRequest("namecheap.domains.check", { DomainList: normalized.join(",") });
  return parseDomainAvailability(body);
}

export type RegistrationContact = Record<string, string>;

export async function createNamecheapRegistration(input: { hostname: string; years: number; contacts: RegistrationContact; nameservers?: string[] }) {
  await requireGlobalAdmin({ sensitive: true });
  const contactParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.contacts)) {
    if (!/^(Registrant|Tech|Admin|AuxBilling|Billing)[A-Za-z]+$/.test(key)) throw new Error("Invalid registration contact field.");
    contactParams[key] = value;
  }
  const body = await namecheapRequest("namecheap.domains.create", {
    DomainName: input.hostname, Years: input.years,
    ...contactParams,
    Nameservers: input.nameservers?.join(",")
  });
  const match = body.match(/<DomainCreateResult\b([^>]*)\/?>/i);
  if (!match) throw new Error("Namecheap returned no registration result.");
  const attributes = xmlAttributes(match[1]);
  return { domain: attributes.Domain ?? input.hostname, domainId: attributes.DomainID ?? null, orderId: attributes.OrderID ?? null, transactionId: attributes.TransactionID ?? null, registered: attributes.Registered?.toLowerCase() === "true", chargedAmount: attributes.ChargedAmount ?? null };
}

export async function provisionRegisteredDomainDns(hostname: string, verificationToken?: string | null) {
  const row = await db.namecheapConfiguration.findUnique({ where: { id: "platform" } });
  const apiUser = row?.apiUserEncrypted ? decryptConfig(row.apiUserEncrypted) : process.env.NAMECHEAP_API_USER;
  const apiKey = row?.apiKeyEncrypted ? decryptConfig(row.apiKeyEncrypted) : process.env.NAMECHEAP_API_KEY;
  const username = row?.usernameEncrypted ? decryptConfig(row.usernameEncrypted) : process.env.NAMECHEAP_USERNAME || apiUser;
  const clientIp = row?.clientIp || process.env.NAMECHEAP_CLIENT_IP;
  const records = parseRegistrationDnsRecords(row?.registrationDnsRecords);
  const verificationRecord = row?.autoVerificationRecord !== false && verificationToken
    ? { host: "_mychurch-verification", type: "TXT" as const, address: verificationToken, ttl: 300 }
    : null;
  const desiredRecords = [...records, ...(verificationRecord ? [verificationRecord] : [])];
  if (!desiredRecords.length) return { state: "SKIPPED" as const, records: [] };
  if (!apiUser || !apiKey || !username || !clientIp) throw new Error("Namecheap API configuration is incomplete.");
  const normalized = hostname.trim().toLowerCase().replace(/\.+$/, "");
  const labels = normalized.split(".");
  if (labels.length < 2) throw new Error("The registered domain is invalid.");
  const sld = labels.at(-2);
  const tld = labels.at(-1);
  if (!sld || !tld) throw new Error("The registered domain is invalid.");
  const baseParams = { ApiUser: apiUser, ApiKey: apiKey, UserName: username, ClientIP: clientIp, SLD: sld, TLD: tld };
  const getHosts = async () => {
    const params = new URLSearchParams({ ...baseParams, Command: "namecheap.domains.dns.getHosts" });
    const response = await fetch(`https://api.namecheap.com/xml.response?${params}`);
    const body = await response.text();
    if (!response.ok || /Status="ERROR"/i.test(body) || /ErrCount="[^0]"/i.test(body)) throw new Error("Namecheap rejected DNS lookup. Check API permissions, client IP allowlist, and domain ownership.");
    return Array.from(body.matchAll(/<host\b([^>]+)\/?>/gi)).map((match) => {
      const attributes = xmlAttributes(match[1]);
      return { host: attributes.Name || attributes.HostName, type: attributes.Type || attributes.RecordType, address: attributes.Address || attributes.Value, ttl: attributes.TTL || "1800", mxPref: attributes.MXPref };
    }).filter((record) => record.host && record.type && record.address);
  };
  const currentRecords = await getHosts();
  const keys = new Set(desiredRecords.map((record) => `${record.host.toLowerCase()}|${record.type}`));
  const nextRecords = [...currentRecords.filter((record) => !keys.has(`${record.host.toLowerCase()}|${record.type.toUpperCase()}`)), ...desiredRecords];
  const params = new URLSearchParams({ ...baseParams, Command: "namecheap.domains.dns.setHosts" });
  nextRecords.forEach((record, index) => {
    const number = String(index + 1);
    params.set(`HostName${number}`, record.host);
    params.set(`RecordType${number}`, record.type);
    params.set(`Address${number}`, record.address);
    params.set(`TTL${number}`, String(record.ttl));
    if ("mxPref" in record && record.mxPref) params.set(`MXPref${number}`, String(record.mxPref));
  });
  const response = await fetch(`https://api.namecheap.com/xml.response?${params}`);
  const body = await response.text();
  if (!response.ok || /Status="ERROR"/i.test(body) || /ErrCount="[^0]"/i.test(body)) throw new Error("Namecheap rejected DNS provisioning. Check API permissions, client IP allowlist, DNS mode, and domain ownership.");
  return { state: "PROVISIONED" as const, records: desiredRecords };
}

export async function createNamecheapTransfer(input: { hostname: string; eppCode: string }) {
  await requireGlobalAdmin({ sensitive: true });
  if (!input.eppCode.trim()) throw new Error("An EPP code is required.");
  const eppCode = /[^\x20-\x7e]/.test(input.eppCode) ? `base64:${Buffer.from(input.eppCode).toString("base64")}` : input.eppCode;
  const body = await namecheapRequest("namecheap.domains.transfer.create", { DomainName: input.hostname, Years: 1, EPPCode: eppCode });
  const match = body.match(/<DomainTransferCreateResult\b([^>]*)\/?>/i);
  if (!match) throw new Error("Namecheap returned no transfer result.");
  const attributes = xmlAttributes(match[1]);
  return { domain: attributes.Domainname ?? input.hostname, transferId: attributes.TransferID ?? null, orderId: attributes.OrderID ?? null, statusId: attributes.StatusID ?? null, status: attributes.StatusCode ?? null, chargedAmount: attributes.ChargedAmount ?? null };
}

export function parseTransferStatus(xml: string) {
  ensureNamecheapSuccess(xml);
  const match = xml.match(/<DomainTransferGetStatusResult\b([^>]*)\/?>/i);
  if (!match) throw new Error("Namecheap returned no transfer status.");
  const attributes = xmlAttributes(match[1]);
  return { transferId: attributes.TransferID ?? null, statusId: attributes.StatusID ?? null, status: attributes.Status ?? null };
}

export async function getNamecheapTransferStatus(transferId: string) {
  await requireGlobalAdmin();
  return parseTransferStatus(await namecheapRequest("namecheap.domains.transfer.getStatus", { TransferID: transferId }));
}

export function parseTransferList(xml: string) {
  ensureNamecheapSuccess(xml);
  return Array.from(xml.matchAll(/<Transfer\b([^>]*)\/?>/gi)).map((match) => {
    const attributes = xmlAttributes(match[1]);
    return { transferId: attributes.ID ?? null, domain: attributes.Domainname ?? null, statusId: attributes.StatusID ?? null, status: attributes.Status ?? null, statusDate: attributes.StatusDate ?? null };
  });
}

export async function listNamecheapTransfers(input: { listType?: string; searchTerm?: string; page?: number; pageSize?: number } = {}) {
  await requireGlobalAdmin();
  return parseTransferList(await namecheapRequest("namecheap.domains.transfer.getList", { ListType: input.listType, SearchTerm: input.searchTerm, Page: input.page ?? 1, PageSize: input.pageSize ?? 10 }));
}

export async function namecheapStatus() {
  await requireGlobalAdmin();
  const row = await db.namecheapConfiguration.findUnique({ where: { id: "platform" } });
  return {
    configured: Boolean(row?.apiKeyEncrypted || process.env.NAMECHEAP_API_KEY),
    domain: row?.domain || process.env.NAMECHEAP_DOMAIN || null,
    clientIpConfigured: Boolean(row?.clientIp || process.env.NAMECHEAP_CLIENT_IP),
    registrationDnsRecords: parseRegistrationDnsRecords(row?.registrationDnsRecords),
    autoVerificationRecord: row?.autoVerificationRecord !== false
  };
}

export async function saveNamecheapConfig(input: Record<string, unknown>) {
  const context = await requireGlobalAdmin({ sensitive: true });
  if (typeof input.domain !== "string" || !input.domain.trim()) throw new Error("Namecheap domain is required.");
  const registrationDnsRecords = parseRegistrationDnsRecords(input.registrationDnsRecords);
  if (Array.isArray(input.registrationDnsRecords) && registrationDnsRecords.length !== input.registrationDnsRecords.length) throw new Error("Every registration DNS record must have a valid host, type, value, and TTL between 60 and 86400 seconds.");
  const values = {
    id: "platform",
    apiUserEncrypted: typeof input.apiUser === "string" && input.apiUser ? encryptConfig(input.apiUser) : undefined,
    apiKeyEncrypted: typeof input.apiKey === "string" && input.apiKey ? encryptConfig(input.apiKey) : undefined,
    usernameEncrypted: typeof input.username === "string" && input.username ? encryptConfig(input.username) : undefined,
    clientIp: typeof input.clientIp === "string" ? input.clientIp.trim() : undefined,
    domain: input.domain.trim().toLowerCase().replace(/\.+$/, ""),
    registrationDnsRecords,
    autoVerificationRecord: input.autoVerificationRecord !== false
  };
  await db.namecheapConfiguration.upsert({ where: { id: "platform" }, create: values, update: values });
  await logAudit({ activityType: "global-admin-namecheap-configuration-updated", summary: "Updated Namecheap platform configuration.", actorId: context.user.id, details: buildGlobalAuditDetails({ scope: "platform", targetType: "namecheap-configuration", metadata: { domain: values.domain, secretsUpdated: Boolean(values.apiKeyEncrypted) } }) });
  return namecheapStatus();
}

export async function provisionPlatformDns(hostname: string) {
  const row = await db.namecheapConfiguration.findUnique({ where: { id: "platform" } });
  const apiUser = row?.apiUserEncrypted ? decryptConfig(row.apiUserEncrypted) : process.env.NAMECHEAP_API_USER;
  const apiKey = row?.apiKeyEncrypted ? decryptConfig(row.apiKeyEncrypted) : process.env.NAMECHEAP_API_KEY;
  const username = row?.usernameEncrypted ? decryptConfig(row.usernameEncrypted) : process.env.NAMECHEAP_USERNAME || apiUser;
  const domain = (row?.domain || process.env.NAMECHEAP_DOMAIN || "").trim().toLowerCase().replace(/\.+$/, "");
  const clientIp = row?.clientIp || process.env.NAMECHEAP_CLIENT_IP;
  if (!apiUser || !apiKey || !username || !domain || !clientIp) return { state: "UNAVAILABLE" as const, guidance: "Configure Namecheap API user, API key, username, registered domain, and allowlisted client IP before enabling platform DNS provisioning." };
  const label = hostname.endsWith(`.${domain}`) ? hostname.slice(0, -(domain.length + 1)) : hostname;
  const sld = domain.split(".").slice(-2)[0];
  const tld = domain.split(".").slice(-1)[0];
  const baseParams = { ApiUser: apiUser, ApiKey: apiKey, UserName: username, ClientIP: clientIp, SLD: sld, TLD: tld };
  const getHosts = async () => {
    const params = new URLSearchParams({ ...baseParams, Command: "namecheap.domains.dns.getHosts" });
    const response = await fetch(`https://api.namecheap.com/xml.response?${params}`);
    const body = await response.text();
    if (!response.ok || /Status="ERROR"/i.test(body) || /ErrCount="[^0]"/i.test(body)) throw new Error("Namecheap rejected DNS lookup. Check API permissions, client IP allowlist, and domain ownership.");
    return Array.from(body.matchAll(/<host\b([^>]+)\/?>/gi)).map((match) => {
      const attributes = Object.fromEntries(Array.from(match[1].matchAll(/(\w+)="([^"]*)"/g)).map(([, key, value]) => [key, value]));
      return { name: attributes.Name || attributes.HostName, type: attributes.Type || attributes.RecordType, address: attributes.Address || attributes.Value, ttl: attributes.TTL || "1800", mxPref: attributes.MXPref };
    }).filter((record) => record.name && record.type && record.address);
  };
  const records = await getHosts();
  const filteredRecords = records.filter((record) => !(record.name === label && record.type === "CNAME"));
  const target = `${(process.env.PLATFORM_DNS_TARGET || domain).trim().replace(/\.+$/, "")}.`;
  const nextRecords = [...filteredRecords, { name: label, type: "CNAME", address: target, ttl: "300", mxPref: undefined }];
  const params = new URLSearchParams({ ...baseParams, Command: "namecheap.domains.dns.setHosts" });
  nextRecords.forEach((record, index) => {
    const number = String(index + 1);
    params.set(`HostName${number}`, record.name);
    params.set(`RecordType${number}`, record.type);
    params.set(`Address${number}`, record.address);
    params.set(`TTL${number}`, record.ttl);
    if (record.mxPref) params.set(`MXPref${number}`, record.mxPref);
  });
  const response = await fetch(`https://api.namecheap.com/xml.response?${params}`);
  const body = await response.text();
  if (!response.ok || /Status="ERROR"/i.test(body) || /ErrCount="[^0]"/i.test(body)) return { state: "ERROR" as const, guidance: "Namecheap rejected DNS provisioning. Check API permissions, client IP allowlist, DNS mode, and domain ownership." };
  const verifiedRecords = await getHosts();
  const normalizeRecordName = (value: string) => value.toLowerCase().replace(/\.$/, "").replace(new RegExp(`\\.${domain.replace(/\./g, "\\.")}$`, "i"), "");
  const normalizeAddress = (value: string) => value.toLowerCase().replace(/\.$/, "");
  const verified = verifiedRecords.some((record) => normalizeRecordName(record.name) === normalizeRecordName(label) && record.type.toUpperCase() === "CNAME" && normalizeAddress(record.address) === normalizeAddress(target));
  if (!verified) {
    const observed = verifiedRecords.slice(0, 20).map((record) => `${record.name} ${record.type} ${record.address}`).join("; ");
    return { state: "ERROR" as const, guidance: `Namecheap accepted the DNS update but verification did not find the expected CNAME. Expected ${label} CNAME ${target}. Records returned: ${observed || "none"}. Confirm the domain uses Namecheap DNS and try again.` };
  }
  return { state: "PROVISIONED" as const, guidance: "Namecheap provisioned and verified the DNS record." };
}
