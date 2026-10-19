import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getConfiguredApiBase, getConfiguredSecret } from "@/lib/billing-config";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function checkoutReturnUrl(name: "BILLING_CHECKOUT_SUCCESS_URL" | "BILLING_CHECKOUT_CANCEL_URL") {
  const configured = process.env[name];
  if (configured) return configured;
  const base = process.env.NEXTAUTH_URL;
  if (!base) throw new Error(`${name} is not configured.`);
  const url = new URL(base);
  if (url.pathname === "/" || !url.pathname) url.pathname = "/admin/billing";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export async function createStripeCheckout(input: { subscriptionId: string; planSlug: string; planName: string; price: string | { toString(): string }; currency: string; interval: string; siteId: string }) {
  const secret = await getConfiguredSecret("STRIPE", "secretKey", "STRIPE_SECRET_KEY"); if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const recurring = input.interval === "MONTHLY" ? { interval: "month", interval_count: "1" } : input.interval === "QUARTERLY" ? { interval: "month", interval_count: "3" } : input.interval === "SEMI_ANNUAL" ? { interval: "month", interval_count: "6" } : { interval: "year", interval_count: "1" };
  const amount = Math.round(Number(input.price.toString()) * 100);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("The billing plan price is invalid.");
  const body = new URLSearchParams({ mode: "subscription", "line_items[0][price_data][currency]": input.currency.toLowerCase(), "line_items[0][price_data][unit_amount]": String(amount), "line_items[0][price_data][product_data][name]": input.planName, "line_items[0][price_data][recurring][interval]": recurring.interval, "line_items[0][price_data][recurring][interval_count]": String(recurring.interval_count), "line_items[0][quantity]": "1", success_url: `${checkoutReturnUrl("BILLING_CHECKOUT_SUCCESS_URL")}?provider=STRIPE&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${checkoutReturnUrl("BILLING_CHECKOUT_CANCEL_URL")}?provider=STRIPE`, "metadata[localSubscriptionId]": input.subscriptionId, "metadata[siteId]": input.siteId });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  const value = await response.json().catch(() => ({}));
  if (!response.ok || typeof value.id !== "string" || typeof value.url !== "string") throw new Error("Stripe checkout could not be created.");
  return { externalId: value.id, checkoutUrl: value.url };
}

export async function createPayPalSubscription(input: { subscriptionId: string; planSlug: string; planName: string; price: string | { toString(): string }; currency: string; interval: string; siteId: string }) {
  const clientId = await getConfiguredSecret("PAYPAL", "clientId", "PAYPAL_CLIENT_ID"); const clientSecret = await getConfiguredSecret("PAYPAL", "clientSecret", "PAYPAL_CLIENT_SECRET"); if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured.");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const base = await getConfiguredApiBase();
  const tokenResponse = await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || typeof token.access_token !== "string") throw new Error("PayPal access token could not be obtained.");
  const planEnvironmentKey = `PAYPAL_PLAN_${input.planSlug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${input.interval}`;
  let planId = process.env[planEnvironmentKey];
  if (!planId) {
    const frequency = input.interval === "MONTHLY" ? { interval_unit: "MONTH", interval_count: 1 } : input.interval === "QUARTERLY" ? { interval_unit: "MONTH", interval_count: 3 } : input.interval === "SEMI_ANNUAL" ? { interval_unit: "MONTH", interval_count: 6 } : { interval_unit: "YEAR", interval_count: 1 };
    const productResponse = await fetch(`${base}/v1/catalogs/products`, { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", "PayPal-Request-Id": `${input.subscriptionId}-product` }, body: JSON.stringify({ name: input.planName, description: `${input.planName} subscription`, type: "SERVICE", category: "SOFTWARE" }) });
    const product = await productResponse.json().catch(() => ({}));
    if (!productResponse.ok || typeof product.id !== "string") throw new Error("PayPal product could not be created.");
    const price = Number(input.price.toString()).toFixed(2);
    const planResponse = await fetch(`${base}/v1/billing/plans`, { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", "PayPal-Request-Id": `${input.subscriptionId}-plan` }, body: JSON.stringify({ product_id: product.id, name: `${input.planName} ${input.interval}`, description: `${input.planName} subscription`, status: "ACTIVE", billing_cycles: [{ frequency: frequency, tenure_type: "REGULAR", sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: price, currency_code: input.currency } } }], payment_preferences: { auto_bill_outstanding: true, setup_fee: { value: "0.00", currency_code: input.currency }, setup_fee_failure_action: "CONTINUE", payment_failure_threshold: 1 } }) });
    const plan = await planResponse.json().catch(() => ({}));
    if (!planResponse.ok || typeof plan.id !== "string") throw new Error("PayPal billing plan could not be created.");
    planId = plan.id;
  }
  const response = await fetch(`${base}/v1/billing/subscriptions`, { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", "PayPal-Request-Id": input.subscriptionId }, body: JSON.stringify({ plan_id: planId, custom_id: input.subscriptionId, application_context: { return_url: `${checkoutReturnUrl("BILLING_CHECKOUT_SUCCESS_URL")}?provider=PAYPAL`, cancel_url: `${checkoutReturnUrl("BILLING_CHECKOUT_CANCEL_URL")}?provider=PAYPAL` } }) });
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
  if (status === "ACTIVE") {
    const subscription = await db.subscription.findUnique({ where: { id: localId }, select: { churchId: true } });
    if (subscription) await db.church.update({ where: { id: subscription.churchId }, data: { lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE", status: "ACTIVE" } });
  }
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
  if (provider === "PAYPAL" && (action === "REFRESH" || action === "CANCEL_AT_PERIOD_END")) {
    const clientId = await getConfiguredSecret("PAYPAL", "clientId", "PAYPAL_CLIENT_ID"); const clientSecret = await getConfiguredSecret("PAYPAL", "clientSecret", "PAYPAL_CLIENT_SECRET"); if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured.");
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const base = await getConfiguredApiBase();
    const tokenResponse = await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    const token = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || typeof token.access_token !== "string") throw new Error("PayPal access token could not be obtained.");
    const response = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(externalId)}${action === "CANCEL_AT_PERIOD_END" ? "/cancel" : ""}`, { method: action === "CANCEL_AT_PERIOD_END" ? "POST" : "GET", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, ...(action === "CANCEL_AT_PERIOD_END" ? { body: JSON.stringify({ reason: "Customer requested cancellation at the end of the current billing period." }) } : {}) });
    if (action === "CANCEL_AT_PERIOD_END") {
      if (!response.ok && response.status !== 204) throw new Error("PayPal subscription cancellation failed.");
      return { status: "ACTIVE", cancelAtPeriodEnd: true };
    }
    const value = await response.json().catch(() => ({}));
    if (!response.ok || typeof value.status !== "string") throw new Error("PayPal subscription refresh failed.");
    return { status: value.status === "ACTIVE" ? "ACTIVE" : value.status === "CANCELLED" ? "CANCELED" : "PAST_DUE", cancelAtPeriodEnd: false };
  }
  throw new Error("The requested provider action is unavailable.");
}
