import crypto from "node:crypto";
import { BillingEnvironment, BillingProvider } from "@prisma/client";
import { db } from "@/lib/db";

const masterKey = () => {
  const raw = process.env.BILLING_CONFIG_MASTER_KEY;
  if (!raw) throw new Error("Billing configuration storage is not configured.");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("BILLING_CONFIG_MASTER_KEY must be a 32-byte hex or base64 key.");
  return key;
};

export function encryptBillingSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptBillingSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !encrypted) throw new Error("Stored billing configuration is invalid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function getBillingProviderConfig(provider: BillingProvider, environment: BillingEnvironment = "TEST") {
  const model = db.billingProviderConfiguration;
  return model?.findUnique({ where: { provider_environment: { provider, environment } } }) ?? null;
}

export async function getConfiguredSecret(provider: BillingProvider, field: "secretKey" | "webhookSecret" | "clientId" | "clientSecret" | "webhookId", fallbackName: string) {
  const config = await getBillingProviderConfig(provider);
  const encrypted = provider === "STRIPE"
    ? field === "secretKey" ? config?.stripeSecretKeyEncrypted : config?.stripeWebhookSecretEncrypted
    : field === "clientId" ? config?.paypalClientIdEncrypted : field === "clientSecret" ? config?.paypalClientSecretEncrypted : config?.paypalWebhookIdEncrypted;
  return encrypted ? decryptBillingSecret(encrypted) : process.env[fallbackName];
}

export async function getConfiguredApiBase() {
  const config = await getBillingProviderConfig("PAYPAL");
  return config?.paypalApiBaseUrl || process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";
}

export async function providerConfiguredWithStored(provider: BillingProvider) {
  if (provider === "STRIPE") return Boolean(await getConfiguredSecret("STRIPE", "secretKey", "STRIPE_SECRET_KEY"));
  return Boolean(await getConfiguredSecret("PAYPAL", "clientId", "PAYPAL_CLIENT_ID") && await getConfiguredSecret("PAYPAL", "clientSecret", "PAYPAL_CLIENT_SECRET"));
}

export async function billingConfigStatus() {
  const rows = await db.billingProviderConfiguration.findMany({ select: { provider: true, environment: true, stripeSecretKeyEncrypted: true, stripeWebhookSecretEncrypted: true, paypalClientIdEncrypted: true, paypalClientSecretEncrypted: true, paypalWebhookIdEncrypted: true, paypalApiBaseUrl: true, updatedAt: true } });
  return rows.map((row) => ({ provider: row.provider, environment: row.environment, configured: row.provider === "STRIPE" ? Boolean(row.stripeSecretKeyEncrypted || process.env.STRIPE_SECRET_KEY) : Boolean((row.paypalClientIdEncrypted && row.paypalClientSecretEncrypted) || (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)), webhookConfigured: row.provider === "STRIPE" ? Boolean(row.stripeWebhookSecretEncrypted || process.env.STRIPE_WEBHOOK_SECRET) : Boolean(row.paypalWebhookIdEncrypted || process.env.PAYPAL_WEBHOOK_ID), apiBaseUrl: row.paypalApiBaseUrl || (row.provider === "PAYPAL" ? process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com" : null), updatedAt: row.updatedAt }));
}

export function validateBillingConfig(input: Record<string, unknown>) {
  if (input.provider !== "STRIPE" && input.provider !== "PAYPAL") throw new Error("Unsupported billing provider.");
  if (input.environment !== "TEST" && input.environment !== "LIVE") throw new Error("Unsupported billing environment.");
  if (input.provider === "PAYPAL" && input.apiBaseUrl && (typeof input.apiBaseUrl !== "string" || !/^https:\/\//i.test(input.apiBaseUrl))) throw new Error("PayPal API base URL must use HTTPS.");
}
