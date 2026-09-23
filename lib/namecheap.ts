import { decryptConfig, encryptConfig } from "@/lib/app-config";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";

export async function namecheapStatus() {
  await requireGlobalAdmin();
  const row = await db.namecheapConfiguration.findUnique({ where: { id: "platform" } });
  return { configured: Boolean(row?.apiKeyEncrypted || process.env.NAMECHEAP_API_KEY), domain: row?.domain || process.env.NAMECHEAP_DOMAIN || null, clientIpConfigured: Boolean(row?.clientIp || process.env.NAMECHEAP_CLIENT_IP) };
}

export async function saveNamecheapConfig(input: Record<string, unknown>) {
  const context = await requireGlobalAdmin({ sensitive: true });
  if (typeof input.domain !== "string" || !input.domain.trim()) throw new Error("Namecheap domain is required.");
  const values = {
    id: "platform",
    apiUserEncrypted: typeof input.apiUser === "string" && input.apiUser ? encryptConfig(input.apiUser) : undefined,
    apiKeyEncrypted: typeof input.apiKey === "string" && input.apiKey ? encryptConfig(input.apiKey) : undefined,
    usernameEncrypted: typeof input.username === "string" && input.username ? encryptConfig(input.username) : undefined,
    clientIp: typeof input.clientIp === "string" ? input.clientIp.trim() : undefined,
    domain: input.domain.trim().toLowerCase().replace(/\.+$/, "")
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
