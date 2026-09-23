import { BillingInterval, BillingProvider, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireCurrentChurch } from "@/lib/tenant";
import { requirePermission } from "@/lib/auth";
import { createPayPalSubscription, createStripeCheckout } from "@/lib/billing-providers";
import { providerConfiguredWithStored } from "@/lib/billing-config";

export function providerConfigured(provider: BillingProvider) {
  return provider === "STRIPE" ? Boolean(process.env.STRIPE_SECRET_KEY) : Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export async function listAvailableBillingPlans() {
  await requirePermission("MANAGE_SETTINGS");
  const plans = await db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true, description: true, monthlyPrice: true, annualPrice: true, currency: true, stripeEnabled: true, paypalEnabled: true } });
  const [stripeConfigured, paypalConfigured] = await Promise.all([providerConfiguredWithStored("STRIPE"), providerConfiguredWithStored("PAYPAL")]);
  return plans.map((plan) => ({ ...plan, monthlyPrice: plan.monthlyPrice.toString(), annualPrice: plan.annualPrice.toString(), providers: { STRIPE: plan.stripeEnabled && stripeConfigured, PAYPAL: plan.paypalEnabled && paypalConfigured } }));
}

export async function initiateBillingSubscription(input: { planId: unknown; provider: unknown; interval: unknown }) {
  const actor = await requirePermission("MANAGE_SETTINGS");
  const { church } = await requireCurrentChurch();
  if (input.provider !== "STRIPE" && input.provider !== "PAYPAL") throw new Error("Unsupported billing provider.");
  if (input.interval !== "MONTHLY" && input.interval !== "ANNUAL") throw new Error("Unsupported billing interval.");
  const provider = input.provider as BillingProvider;
  const interval = input.interval as BillingInterval;
  if (!await providerConfiguredWithStored(provider)) throw new Error(`${provider} billing is not configured.`);
  if (typeof input.planId !== "string" || !input.planId) throw new Error("A billing plan is required.");
  const plan = await db.subscriptionPlan.findFirst({ where: { id: input.planId, isActive: true }, select: { id: true, slug: true, name: true, stripeEnabled: true, paypalEnabled: true } });
  if (!plan) throw new Error("Billing plan is unavailable.");
  if ((provider === "STRIPE" && !plan.stripeEnabled) || (provider === "PAYPAL" && !plan.paypalEnabled)) throw new Error("The selected provider is unavailable for this plan.");
  const existing = await db.subscription.findFirst({ where: { churchId: church.id, planId: plan.id, provider, interval, status: SubscriptionStatus.INCOMPLETE }, select: { id: true, status: true, provider: true, interval: true } });
  if (existing) return { ...existing, reused: true, paymentStatus: "PENDING_PROVIDER_CONFIRMATION" };
  const subscription = await db.subscription.create({ data: { churchId: church.id, planId: plan.id, provider, interval, status: SubscriptionStatus.INCOMPLETE }, select: { id: true, status: true, provider: true, interval: true } });
  const checkout = provider === "STRIPE"
    ? await createStripeCheckout({ subscriptionId: subscription.id, planSlug: plan.slug, interval, siteId: church.id })
    : await createPayPalSubscription({ subscriptionId: subscription.id, planSlug: plan.slug, interval, siteId: church.id });
  await db.subscription.update({ where: { id: subscription.id }, data: { externalSubscriptionId: checkout.externalId } });
  await logAudit({ activityType: "billing-subscription-initiation-requested", summary: `Started a ${provider} subscription checkout request for ${plan.name}.`, actorId: actor.id, details: JSON.stringify({ boundary: "tenant-billing", churchId: church.id, targetType: "subscription", targetId: subscription.id, metadata: { provider, interval, paymentStatus: "PENDING_PROVIDER_CONFIRMATION" } }) });
  return { ...subscription, reused: false, checkoutUrl: checkout.checkoutUrl, paymentStatus: "PENDING_PROVIDER_CONFIRMATION" };
}
