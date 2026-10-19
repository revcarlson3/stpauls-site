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

function numericId(body: unknown) {
  const data = responseData(body);
  if (!data || typeof data !== "object") return null;
  const value = "id" in data ? (data as { id: unknown }).id : "ID" in data ? (data as { ID: unknown }).ID : null;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

async function panelRequest<T>(config: NonNullable<Awaited<ReturnType<typeof configuration>>>, path: string, body: Record<string, unknown>) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatures = /^1(?:\.|$)/.test(config.version ?? "")
    ? [legacyToken(config.apiKey, timestamp)]
    : [token(config.apiKey, timestamp), legacyToken(config.apiKey, timestamp)];
  let lastResponse: Response | null = null;
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
    if (response.ok) return parsed as T;
  }
  throw new Error(`1Panel request failed (${lastResponse?.status ?? "no response"}).`);
}

async function panelGet<T>(config: NonNullable<Awaited<ReturnType<typeof configuration>>>, path: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatures = /^1(?:\.|$)/.test(config.version ?? "")
    ? [legacyToken(config.apiKey, timestamp)]
    : [token(config.apiKey, timestamp), legacyToken(config.apiKey, timestamp)];
  let lastResponse: Response | null = null;
  for (const signature of signatures) {
    const response = await fetch(`${config.baseUrl}${apiPath(config.version, path)}`, {
      method: "GET",
      headers: { "1Panel-Token": signature, "1Panel-Timestamp": timestamp, Accept: "application/json" }
    });
    lastResponse = response;
    const text = await response.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    if (response.ok) return parsed as T;
  }
  throw new Error(`1Panel request failed (${lastResponse?.status ?? "no response"}).`);
}

function certificateStatus(body: unknown) {
  const data = responseData(body);
  return data && typeof data === "object" && "status" in data ? String((data as { status: unknown }).status) : "";
}

export type DomainTlsProvisioningResult = {
  certificateId: number;
  websiteId: number;
};

export async function provisionCustomDomainTls(hostname: string): Promise<DomainTlsProvisioningResult> {
  const config = await configuration();
  if (!config) throw new Error("Configure 1Panel before provisioning SSL.");
  if (!config.websiteId || !config.acmeAccountId) throw new Error("Configure the 1Panel website ID and Let’s Encrypt account ID before provisioning SSL.");
  const created = await panelRequest<unknown>(config, "/websites/ssl", {
    primaryDomain: hostname,
    otherDomains: "",
    provider: "http",
    acmeAccountId: config.acmeAccountId,
    autoRenew: true,
    keyType: "EC256",
    skipDNS: true,
    apply: true
  });
  const certificateId = numericId(created);
  if (!certificateId) throw new Error("1Panel did not return a certificate ID.");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = certificateStatus(await panelGet(config, `/websites/ssl/${certificateId}`));
    if (status === "ready") break;
    if (status === "error" || status === "applyError") throw new Error("1Panel Let’s Encrypt certificate issuance failed.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (attempt === 59) throw new Error("1Panel Let’s Encrypt certificate issuance timed out.");
  }
  await panelRequest(config, "/websites/batch/ssl", {
    ids: [config.websiteId],
    taskID: crypto.randomUUID(),
    websiteSSLId: certificateId,
    type: "existed",
    httpConfig: "HTTPToHTTPS"
  });
  return { certificateId, websiteId: config.websiteId };
}

export function platformTlsStatus(config: { wildcardSslId: number | null } | null) {
  return config?.wildcardSslId ? "WILDCARD_ACTIVE" : "PENDING_WILDCARD_CONFIGURATION";
}

export async function onePanelPlatformTlsStatus() {
  const config = await configuration();
  return platformTlsStatus(config);
}

export async function onePanelStatus() {
  await requireGlobalAdmin();
  const row = await db.onePanelConfiguration.findUnique({ where: { id: "platform" }, select: { baseUrl: true, version: true, websiteId: true, acmeAccountId: true, wildcardSslId: true, platformSuffix: true, updatedAt: true } });
  return {
    configured: Boolean(row),
    baseUrl: row?.baseUrl ?? null,
    version: row?.version ?? null,
    websiteId: row?.websiteId ?? null,
    acmeAccountId: row?.acmeAccountId ?? null,
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
  const websiteId = typeof input.websiteId === "number" && Number.isInteger(input.websiteId) && input.websiteId > 0 ? input.websiteId : null;
  const acmeAccountId = typeof input.acmeAccountId === "number" && Number.isInteger(input.acmeAccountId) && input.acmeAccountId > 0 ? input.acmeAccountId : null;
  const wildcardSslId = typeof input.wildcardSslId === "number" && Number.isInteger(input.wildcardSslId) && input.wildcardSslId > 0 ? input.wildcardSslId : null;
  const platformSuffix = typeof input.platformSuffix === "string" && input.platformSuffix.trim() ? input.platformSuffix.trim().toLowerCase() : "mychurch.one";
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("1Panel base URL must include http:// or https://.");
  const existing = await db.onePanelConfiguration.findUnique({ where: { id: "platform" }, select: { apiKeyEncrypted: true } });
  if (!apiKey && !existing) throw new Error("1Panel API key is required.");
  await db.onePanelConfiguration.upsert({
    where: { id: "platform" },
    create: { id: "platform", baseUrl, apiKeyEncrypted: encryptConfig(apiKey), version, websiteId, acmeAccountId, wildcardSslId, platformSuffix },
    update: { baseUrl, ...(apiKey ? { apiKeyEncrypted: encryptConfig(apiKey) } : {}), version, websiteId, acmeAccountId, wildcardSslId, platformSuffix }
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
  }
  throw new Error("1Panel did not return an API JSON response. Verify that the configured URL exposes the panel API (including /api/v2), the API interface is enabled, and the caller IP is in the API allowlist.");
}
