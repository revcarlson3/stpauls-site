import crypto from "node:crypto";
import { db } from "@/lib/db";
import { decryptConfig, encryptConfig } from "@/lib/app-config";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";
import { logAudit } from "@/lib/audit";

function token(apiKey: string, timestamp: string) {
  return crypto.createHmac("sha256", apiKey).update(`1panel:${timestamp}`).digest("hex");
}

function legacyToken(apiKey: string, timestamp: string) {
  return crypto.createHash("md5").update(`1panel${apiKey}${timestamp}`).digest("hex");
}

async function configuration() {
  const row = await db.onePanelConfiguration.findUnique({ where: { id: "platform" } });
  return row ? {
    baseUrl: row.baseUrl.replace(/\/+$/, ""),
    apiKey: decryptConfig(row.apiKeyEncrypted),
    version: row.version,
    websiteId: row.websiteId,
    acmeAccountId: row.acmeAccountId,
    dnsAccountId: row.dnsAccountId,
    wildcardSslId: row.wildcardSslId,
    platformSuffix: row.platformSuffix
  } : null;
}

function apiPath(version: string | null | undefined, path: string) {
  return `/api/${/^1(?:\.|$)/.test(version ?? "") ? "v1" : "v2"}${path}`;
}

function responseData(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in body) return (body as { data: unknown }).data;
  return body;
}

function responseMessage(body: unknown): string {
  if (Array.isArray(body)) {
    return body.map(responseMessage).find(Boolean) ?? "";
  }
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  for (const key of ["message", "msg", "error", "err", "detail", "remark"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  const data = record.data;
  if (data && typeof data === "object") return responseMessage(data);
  try {
    const serialized = JSON.stringify(body);
    return serialized && serialized.length <= 500 ? serialized : "";
  } catch {
    return "";
  }
}

function numericId(body: unknown): number | null {
  const data = responseData(body);
  if (typeof data === "number") {
    return Number.isSafeInteger(data) && data > 0 ? data : null;
  }
  if (typeof data === "string" && /^\d+$/.test(data.trim())) {
    const parsed = Number(data);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  for (const key of ["id", "ID", "certificateId", "sslId", "websiteSSLId"]) {
    const value = numericId(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function containsRecordId(body: unknown, expectedId: number): boolean {
  if (Array.isArray(body)) return body.some((item) => containsRecordId(item, expectedId));
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  for (const key of ["id", "ID"]) {
    if (numericId(record[key]) === expectedId) return true;
  }
  return Object.values(record).some((value) => containsRecordId(value, expectedId));
}

function containsDomain(body: unknown, hostname: string): boolean {
  const normalizeDomain = (value: string) => value.trim().toLowerCase().replace(/\.+$/, "").replace(/:\d+$/, "");
  if (Array.isArray(body)) return body.some((item) => containsDomain(item, hostname));
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  for (const key of ["domain", "primaryDomain"]) {
    if (typeof record[key] === "string" && normalizeDomain(record[key]) === normalizeDomain(hostname)) return true;
  }
  if (typeof record.domains === "string" && record.domains.split(/[,\n]/).some((domain) => normalizeDomain(domain) === normalizeDomain(hostname))) return true;
  return Object.values(record).some((value) => containsDomain(value, hostname));
}

function panelDomains(body: unknown): string[] {
  if (Array.isArray(body)) return body.flatMap(panelDomains);
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  const domains: string[] = [];
  for (const key of ["domain", "primaryDomain", "domains"]) {
    const value = record[key];
    if (typeof value === "string") {
      domains.push(...value.split(/[,\n]/).map((domain) => domain.trim()).filter(Boolean));
    }
  }
  return [...domains, ...Object.values(record).flatMap(panelDomains)];
}

async function panelRequest<T>(
  config: NonNullable<Awaited<ReturnType<typeof configuration>>>,
  path: string,
  body: Record<string, unknown>,
  operation = "request"
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatures = /^1(?:\.|$)/.test(config.version ?? "")
    ? [legacyToken(config.apiKey, timestamp)]
    : [token(config.apiKey, timestamp), legacyToken(config.apiKey, timestamp)];
  let lastResponse: Response | null = null;
  let lastBody: unknown = null;
  for (const signature of signatures) {
    const response = await fetch(`${config.baseUrl}${apiPath(config.version, path)}`, {
      method: "POST",
      headers: {
        "1Panel-Token": signature,
        "1Panel-Timestamp": timestamp,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    lastResponse = response;
    const text = await response.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    lastBody = parsed;
    if (response.ok) return parsed as T;
  }
  const detail = responseMessage(lastBody);
  throw new Error(`1Panel ${operation} failed (${lastResponse?.status ?? "no response"})${detail ? `: ${detail}` : "."}`);
}

async function panelGet<T>(config: NonNullable<Awaited<ReturnType<typeof configuration>>>, path: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatures = /^1(?:\.|$)/.test(config.version ?? "")
    ? [legacyToken(config.apiKey, timestamp)]
    : [token(config.apiKey, timestamp), legacyToken(config.apiKey, timestamp)];
  let lastResponse: Response | null = null;
  let lastBody: unknown = null;
  for (const signature of signatures) {
    const response = await fetch(`${config.baseUrl}${apiPath(config.version, path)}`, {
      method: "GET",
      headers: { "1Panel-Token": signature, "1Panel-Timestamp": timestamp, Accept: "application/json" }
    });
    lastResponse = response;
    const text = await response.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    lastBody = parsed;
    if (response.ok) return parsed as T;
  }
  const detail = responseMessage(lastBody);
  throw new Error(`1Panel request failed (${lastResponse?.status ?? "no response"})${detail ? `: ${detail}` : "."}`);
}

function certificateStatus(body: unknown) {
  const data = responseData(body);
  return data && typeof data === "object" && "status" in data ? String((data as { status: unknown }).status) : "";
}

function certificateMessage(body: unknown) {
  return responseMessage(body);
}

export type DomainTlsProvisioningResult = {
  certificateId: number;
  websiteId: number;
};

export async function provisionCustomDomainTls(hostname: string): Promise<DomainTlsProvisioningResult> {
  const config = await configuration();
  if (!config) throw new Error("Configure 1Panel before provisioning SSL.");
  if (!config.websiteId || !config.acmeAccountId || !config.dnsAccountId) throw new Error("Configure the 1Panel website ID, Let’s Encrypt account ID, and DNS account ID before provisioning SSL.");
  try {
    await panelRequest(config, "/websites/domains", {
      websiteID: Number(config.websiteId),
      domains: hostname
    }, "domain binding");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/already exists|already added|duplicate|record exists|domain.*exist|已存在|重复/i.test(message)) throw error;
  }
  const boundDomains = await panelGet<unknown>(config, `/websites/domains/${Number(config.websiteId)}`);
  if (!containsDomain(boundDomains, hostname)) {
    const detail = responseMessage(boundDomains);
    throw new Error(`1Panel domain binding did not persist ${hostname} on website ${config.websiteId}${detail ? `; returned: ${detail}` : "."}`);
  }
  const normalizedHostname = hostname.trim().toLowerCase().replace(/\.+$/, "").replace(/:\d+$/, "");
  const otherDomains = Array.from(new Set(panelDomains(boundDomains)
    .map((domain) => domain.replace(/:\d+$/, "").replace(/\.+$/, "").trim())
    .filter((domain) => domain && domain.toLowerCase() !== normalizedHostname))).join("\n");
  const acmeAccounts = await panelRequest<unknown>(config, "/websites/acme/search", {
    page: 1,
    pageSize: 100
  }, "ACME account lookup");
  if (!containsRecordId(acmeAccounts, Number(config.acmeAccountId))) {
    throw new Error(`1Panel ACME account ${config.acmeAccountId} was not found. Enter the local 1Panel ACME account ID, not the account number from the Let's Encrypt URL.`);
  }
  const dnsAccounts = await panelRequest<unknown>(config, "/websites/dns/search", {
    page: 1,
    pageSize: 100
  }, "DNS account lookup");
  if (!containsRecordId(dnsAccounts, Number(config.dnsAccountId))) {
    throw new Error(`1Panel DNS account ${config.dnsAccountId} was not found. Enter the local DNS account record ID configured in 1Panel.`);
  }
  const created = await panelRequest<unknown>(config, "/websites/ssl", {
    primaryDomain: hostname,
    otherDomains,
    provider: "dnsAccount",
    acmeAccountId: Number(config.acmeAccountId),
    dnsAccountId: Number(config.dnsAccountId),
    keyType: "EC256",
    autoRenew: true
  }, "certificate creation");
  const certificateId = numericId(created);
  if (!certificateId) throw new Error("1Panel did not return a certificate ID.");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const certificate = await panelGet(config, `/websites/ssl/${certificateId}`);
    const status = certificateStatus(certificate);
    if (status === "ready") break;
    if (status === "error" || status === "applyError") {
      const detail = certificateMessage(certificate);
      throw new Error(`1Panel Let’s Encrypt certificate issuance failed${detail ? `: ${detail}` : "."}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (attempt === 59) throw new Error("1Panel Let’s Encrypt certificate issuance timed out.");
  }
  await panelRequest(config, "/websites/batch/ssl", {
    ids: [Number(config.websiteId)],
    taskID: crypto.randomUUID(),
    websiteSSLId: certificateId,
    type: "existed",
    httpConfig: "HTTPToHTTPS"
  }, "certificate attachment");
  return { certificateId, websiteId: Number(config.websiteId) };
}

export function platformTlsStatus(config: { wildcardSslId: string | null } | null) {
  return config?.wildcardSslId ? "WILDCARD_ACTIVE" : "PENDING_WILDCARD_CONFIGURATION";
}

export async function onePanelPlatformTlsStatus() {
  const config = await configuration();
  return platformTlsStatus(config);
}

export async function onePanelStatus() {
  await requireGlobalAdmin();
  const row = await db.onePanelConfiguration.findUnique({ where: { id: "platform" }, select: { baseUrl: true, version: true, websiteId: true, acmeAccountId: true, dnsAccountId: true, wildcardSslId: true, platformSuffix: true, updatedAt: true } });
  return {
    configured: Boolean(row),
    baseUrl: row?.baseUrl ?? null,
    version: row?.version ?? null,
    websiteId: row?.websiteId ?? null,
    acmeAccountId: row?.acmeAccountId ?? null,
    dnsAccountId: row?.dnsAccountId ?? null,
    wildcardSslId: row?.wildcardSslId ?? null,
    platformSuffix: row?.platformSuffix ?? "mychurch.one",
    updatedAt: row?.updatedAt?.toISOString() ?? null
  };
}

export async function saveOnePanelConfig(input: Record<string, unknown>) {
  const context = await requireGlobalAdmin({ sensitive: true });
  const baseUrl = typeof input.baseUrl === "string" ? input.baseUrl.trim().replace(/\/+$/, "") : "";
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  const version = typeof input.version === "string" ? input.version.trim() : null;
  const websiteId = typeof input.websiteId === "number" && Number.isInteger(input.websiteId) && input.websiteId > 0 ? String(input.websiteId) : null;
  const acmeAccountId = typeof input.acmeAccountId === "number" && Number.isInteger(input.acmeAccountId) && input.acmeAccountId > 0 ? String(input.acmeAccountId) : null;
  const dnsAccountId = typeof input.dnsAccountId === "number" && Number.isInteger(input.dnsAccountId) && input.dnsAccountId > 0 ? String(input.dnsAccountId) : null;
  const wildcardSslId = typeof input.wildcardSslId === "number" && Number.isInteger(input.wildcardSslId) && input.wildcardSslId > 0 ? String(input.wildcardSslId) : null;
  const platformSuffix = typeof input.platformSuffix === "string" && input.platformSuffix.trim() ? input.platformSuffix.trim().toLowerCase() : "mychurch.one";
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("1Panel base URL must include http:// or https://.");
  const existing = await db.onePanelConfiguration.findUnique({ where: { id: "platform" }, select: { apiKeyEncrypted: true } });
  if (!apiKey && !existing) throw new Error("1Panel API key is required.");
  await db.onePanelConfiguration.upsert({
    where: { id: "platform" },
    create: { id: "platform", baseUrl, apiKeyEncrypted: encryptConfig(apiKey), version, websiteId, acmeAccountId, dnsAccountId, wildcardSslId, platformSuffix },
    update: { baseUrl, ...(apiKey ? { apiKeyEncrypted: encryptConfig(apiKey) } : {}), version, websiteId, acmeAccountId, dnsAccountId, wildcardSslId, platformSuffix }
  });
  await logAudit({ activityType: "global-admin-onepanel-configuration-updated", summary: "Updated 1Panel platform configuration.", actorId: context.user.id, details: buildGlobalAuditDetails({ scope: "platform", targetType: "onepanel-configuration", metadata: { baseUrl, version, secretsUpdated: Boolean(apiKey) } }) });
  return onePanelStatus();
}

export async function testOnePanelConnection() {
  await requireGlobalAdmin({ sensitive: true });
  const config = await configuration();
  if (!config) throw new Error("Configure 1Panel before testing the connection.");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const headers = (apiToken: string) => ({ "1Panel-Token": apiToken, "1Panel-Timestamp": timestamp, Accept: "application/json" });
  const v1 = /^1(?:\.|$)/.test(config.version ?? "");
  const attempts = v1
    ? [{ path: "/api/v1/toolbox/device/base", signature: legacyToken(config.apiKey, timestamp) }]
    : [
        { path: "/api/v2/toolbox/device/base", signature: token(config.apiKey, timestamp) },
        { path: "/api/v2/toolbox/device/base", signature: legacyToken(config.apiKey, timestamp) }
      ];
  for (const attempt of attempts) {
    const response = await fetch(`${config.baseUrl}${attempt.path}`, { method: "POST", headers: headers(attempt.signature) });
    const body = await response.text();
    if (response.ok && /application\/json/i.test(response.headers.get("content-type") ?? "") && !/^\s*</.test(body)) {
      return { connected: true, baseUrl: config.baseUrl, version: config.version };
    }
    if (/enabled domain name binding/i.test(body)) {
      throw new Error("1Panel domain binding rejected this hostname. Configure the integration with the exact bound 1Panel hostname, or reset and reconfigure 1Panel domain binding.");
    }
    if (/enabled secure login access/i.test(body)) {
      throw new Error("1Panel secure entrance is still enabled. Run `1pctl reset entrance` on the 1Panel server, or configure the integration with the secure entrance URL shown by `1pctl user-info`.");
    }
    if (/bridge access is required/i.test(body)) {
      throw new Error("1Panel requires bridge access for this URL. Use the exact API-accessible panel URL shown by `1pctl user-info`, or disable/reset the secure entrance before testing the connection.");
    }
  }
  throw new Error("1Panel did not return an API JSON response. Verify that the configured URL exposes the panel API (including /api/v2), the API interface is enabled, and the caller IP is in the API allowlist.");
}
