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
  return row ? { baseUrl: row.baseUrl.replace(/\/+$/, ""), apiKey: decryptConfig(row.apiKeyEncrypted), version: row.version } : null;
}

export async function onePanelStatus() {
  await requireGlobalAdmin();
  const row = await db.onePanelConfiguration.findUnique({ where: { id: "platform" }, select: { baseUrl: true, version: true, updatedAt: true } });
  return { configured: Boolean(row), baseUrl: row?.baseUrl ?? null, version: row?.version ?? null, updatedAt: row?.updatedAt?.toISOString() ?? null };
}

export async function saveOnePanelConfig(input: Record<string, unknown>) {
  const context = await requireGlobalAdmin({ sensitive: true });
  const baseUrl = typeof input.baseUrl === "string" ? input.baseUrl.trim().replace(/\/+$/, "") : "";
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  const version = typeof input.version === "string" ? input.version.trim() : null;
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("1Panel base URL must include http:// or https://.");
  const existing = await db.onePanelConfiguration.findUnique({ where: { id: "platform" }, select: { apiKeyEncrypted: true } });
  if (!apiKey && !existing) throw new Error("1Panel API key is required.");
  await db.onePanelConfiguration.upsert({
    where: { id: "platform" },
    create: { id: "platform", baseUrl, apiKeyEncrypted: encryptConfig(apiKey), version },
    update: { baseUrl, ...(apiKey ? { apiKeyEncrypted: encryptConfig(apiKey) } : {}), version }
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
