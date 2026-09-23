import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getConfiguredApiBase, getConfiguredSecret } from "@/lib/billing-config";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function createStripeCheckout(input: { subscriptionId: string; planSlug: string; interval: string; siteId: string }) {
  const secret = await getConfiguredSecret("STRIPE", "secretKey", "STRIPE_SECRET_KEY"); if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const price = required(`STRIPE_PRICE_${input.planSlug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${input.interval}`);
  const body = new URLSearchParams({ mode: "subscription", "line_items[0][price]": price, "line_items[0][quantity]": "1", success_url: `${required("BILLING_CHECKOUT_SUCCESS_URL")}?provider=STRIPE&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${required("BILLING_CHECKOUT_CANCEL_URL")}?provider=STRIPE`, "metadata[localSubscriptionId]": input.subscriptionId, "metadata[siteId]": input.siteId });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  const value = await response.json().catch(() => ({}));
  if (!response.ok || typeof value.id !== "string" || typeof value.url !== "string") throw new Error("Stripe checkout could not be created.");
  return { externalId: value.id, checkoutUrl: value.url };
}

export async function createPayPalSubscription(input: { subscriptionId: string; planSlug: string; interval: string; siteId: string }) {
  const clientId = await getConfiguredSecret("PAYPAL", "clientId", "PAYPAL_CLIENT_ID"); const clientSecret = await getConfiguredSecret("PAYPAL", "clientSecret", "PAYPAL_CLIENT_SECRET"); if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured.");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const base = await getConfiguredApiBase();
  const tokenResponse = await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || typeof token.access_token !== "string") throw new Error("PayPal access token could not be obtained.");
  const planId = required(`PAYPAL_PLAN_${input.planSlug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${input.interval}`);
  const response = await fetch(`${base}/v1/billing/subscriptions`, { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", "PayPal-Request-Id": input.subscriptionId }, body: JSON.stringify({ plan_id: planId, custom_id: input.subscriptionId, application_context: { return_url: `${required("BILLING_CHECKOUT_SUCCESS_URL")}?provider=PAYPAL`, cancel_url: `${required("BILLING_CHECKOUT_CANCEL_URL")}?provider=PAYPAL` } }) });
  const value = await response.json().catch(() => ({}));
  const approval = Array.isArray(value.links) ? value.links.find((link: { rel?: string }) => link.rel === "approve")?.href : null;
  if (!response.ok || typeof value.id !== "string" || typeof approval !== "string") throw new Error("PayPal subscription could not be created.");
  return { externalId: value.id, checkoutUrl: approval };
}

export function verifyStripeSignature(payload: string, signature: string, secret: string) {
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=")));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !parts.v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const actual = Buffer.from(parts.v1);
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

export async function applyVerifiedStripeEvent(event: { type: string; data?: { object?: Record<string, unknown> } }) {
  const object = event.data?.object ?? {};
  const metadata = object.metadata as Record<string, unknown> | undefined;
  const localId = typeof metadata?.localSubscriptionId === "string" ? metadata.localSubscriptionId : typeof object.client_reference_id === "string" ? object.client_reference_id : null;
  const externalId = typeof object.subscription === "string" ? object.subscription : typeof object.id === "string" ? object.id : null;
  if (!localId || !externalId) return false;
  const status = event.type.includes("completed") || event.type.includes("active") ? "ACTIVE" : event.type.includes("deleted") || event.type.includes("canceled") ? "CANCELED" : "PAST_DUE";
  await db.subscription.update({ where: { id: localId }, data: { externalSubscriptionId: externalId, status } });
  return true;
}

export async function performProviderBillingAction(provider: string, externalId: string, action: string) {
  if (provider === "STRIPE") {
    const secret = await getConfiguredSecret("STRIPE", "secretKey", "STRIPE_SECRET_KEY"); if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured.");
    if (action === "REFRESH") {
      const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(externalId)}`, { headers: { Authorization: `Bearer ${secret}` } });
      const value = await response.json().catch(() => ({}));
      if (!response.ok || typeof value.status !== "string") throw new Error("Stripe subscription refresh failed.");
      return { status: value.status === "active" ? "ACTIVE" : value.status === "canceled" ? "CANCELED" : "PAST_DUE", cancelAtPeriodEnd: Boolean(value.cancel_at_period_end) };
    }
    const body = new URLSearchParams({ cancel_at_period_end: action === "CANCEL_AT_PERIOD_END" ? "true" : "false" });
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(externalId)}`, { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `billing-${externalId}-${action}` }, body });
    const value = await response.json().catch(() => ({}));
    if (!response.ok || typeof value.id !== "string") throw new Error("Stripe subscription update failed.");
    return { status: value.status === "active" ? "ACTIVE" : value.status === "canceled" ? "CANCELED" : "PAST_DUE", cancelAtPeriodEnd: Boolean(value.cancel_at_period_end) };
  }
  if (provider === "PAYPAL" && action === "REFRESH") {
    const clientId = await getConfiguredSecret("PAYPAL", "clientId", "PAYPAL_CLIENT_ID"); const clientSecret = await getConfiguredSecret("PAYPAL", "clientSecret", "PAYPAL_CLIENT_SECRET"); if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured.");
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const base = await getConfiguredApiBase();
    const tokenResponse = await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    const token = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || typeof token.access_token !== "string") throw new Error("PayPal access token could not be obtained.");
    const response = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(externalId)}`, { headers: { Authorization: `Bearer ${token.access_token}` } });
    const value = await response.json().catch(() => ({}));
    if (!response.ok || typeof value.status !== "string") throw new Error("PayPal subscription refresh failed.");
    return { status: value.status === "ACTIVE" ? "ACTIVE" : value.status === "CANCELLED" ? "CANCELED" : "PAST_DUE", cancelAtPeriodEnd: false };
  }
  throw new Error("The requested provider action is unavailable.");
}
