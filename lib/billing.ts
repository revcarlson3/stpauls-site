import { BillingInterval, BillingProvider, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireCurrentChurch } from "@/lib/tenant";
import { createPayPalSubscription, createStripeCheckout } from "@/lib/billing-providers";
import { providerConfiguredWithStored } from "@/lib/billing-config";
import { validateTenantCoupon } from "@/lib/billing-coupons";

export function providerConfigured(provider: BillingProvider) {
  return provider === "STRIPE" ? Boolean(process.env.STRIPE_SECRET_KEY) : Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function customDomainOption(plan: { interval: BillingInterval | null; entitlements: { mode: string; addOnMonthly: unknown; addOnAnnual: unknown }[] }) {
  const entitlement = plan.entitlements?.[0];
  if (!entitlement || entitlement.mode === "DISABLED") return { available: false, included: false, price: "0.00" };
  if (entitlement.mode === "INCLUDED") return { available: true, included: true, price: "0.00" };
  const price = plan.interval === "ANNUAL" ? entitlement.addOnAnnual : entitlement.addOnMonthly;
  return { available: true, included: false, price: price === null || price === undefined ? "0.00" : price.toString() };
}

export async function listAvailableBillingPlans() {
  await requireCurrentChurch({ allowUnsubscribed: true });
  const plans = await db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true, description: true, price: true, interval: true, monthlyPrice: true, annualPrice: true, currency: true, stripeEnabled: true, paypalEnabled: true, entitlements: { where: { moduleSlug: "custom-domains" }, select: { mode: true, addOnMonthly: true, addOnAnnual: true } } } });
  const [stripeConfigured, paypalConfigured] = await Promise.all([providerConfiguredWithStored("STRIPE"), providerConfiguredWithStored("PAYPAL")]);
  return plans.map((plan) => ({ ...plan, price: (plan.price ?? plan.monthlyPrice).toString(), interval: plan.interval ?? "MONTHLY", monthlyPrice: plan.monthlyPrice.toString(), annualPrice: plan.annualPrice.toString(), customDomain: customDomainOption(plan), providers: { STRIPE: plan.stripeEnabled && stripeConfigured, PAYPAL: plan.paypalEnabled && paypalConfigured } }));
}

export async function getBillingQuote(input: { planId: unknown; provider: unknown; interval?: unknown; couponCode?: unknown; customDomain?: unknown }) {
  await requireCurrentChurch({ allowUnsubscribed: true });
  if (input.provider !== "STRIPE" && input.provider !== "PAYPAL") throw new Error("Unsupported billing provider.");
  if (typeof input.planId !== "string" || !input.planId) throw new Error("A billing plan is required.");
  const plan = await db.subscriptionPlan.findFirst({ where: { id: input.planId, isActive: true }, select: { id: true, name: true, currency: true, price: true, interval: true, monthlyPrice: true, annualPrice: true, entitlements: { where: { moduleSlug: "custom-domains" }, select: { mode: true, addOnMonthly: true, addOnAnnual: true } } } });
  if (!plan) throw new Error("Billing plan is unavailable.");
  const interval = (plan.interval ?? "MONTHLY") as BillingInterval;
  if (input.interval && input.interval !== interval) throw new Error("The selected plan has a fixed billing interval.");
  const customDomain = customDomainOption(plan);
  const addOnSelected = customDomain.available && input.customDomain === true && !customDomain.included;
  const addOnPrice = addOnSelected ? Number(customDomain.price) : 0;
  const subtotal = Number((plan.price ?? (interval === "MONTHLY" ? plan.monthlyPrice : plan.annualPrice)).toString()) + addOnPrice;
  const coupon = input.couponCode ? await validateTenantCoupon({ code: input.couponCode, planId: plan.id, interval, additionalPrice: addOnPrice }) : null;
  return { planId: plan.id, planName: plan.name, provider: input.provider, interval, currency: plan.currency, planPrice: subtotal - addOnPrice, addOnPrice, addOnSelected, subtotal: subtotal.toFixed(2), discount: coupon?.discount ?? "0.00", total: coupon?.total ?? subtotal.toFixed(2), couponCode: coupon?.code ?? null, customDomain };
}

export async function initiateBillingSubscription(input: { planId: unknown; provider: unknown; interval?: unknown; couponCode?: unknown; customDomain?: unknown }) {
  const { user: actor, church } = await requireCurrentChurch({ allowUnsubscribed: true });
  if (input.provider !== "STRIPE" && input.provider !== "PAYPAL") throw new Error("Unsupported billing provider.");
  const provider = input.provider as BillingProvider;
  if (!await providerConfiguredWithStored(provider)) throw new Error(`${provider} billing is not configured.`);
  if (typeof input.planId !== "string" || !input.planId) throw new Error("A billing plan is required.");
  const plan = await db.subscriptionPlan.findFirst({ where: { id: input.planId, isActive: true }, select: { id: true, slug: true, name: true, currency: true, price: true, interval: true, monthlyPrice: true, annualPrice: true, stripeEnabled: true, paypalEnabled: true, entitlements: { where: { moduleSlug: "custom-domains" }, select: { mode: true, addOnMonthly: true, addOnAnnual: true } } } });
  if (!plan) throw new Error("Billing plan is unavailable.");
  const interval = (plan.interval ?? "MONTHLY") as BillingInterval;
  if (input.interval && input.interval !== interval) throw new Error("The selected plan has a fixed billing interval.");
  if ((provider === "STRIPE" && !plan.stripeEnabled) || (provider === "PAYPAL" && !plan.paypalEnabled)) throw new Error("The selected provider is unavailable for this plan.");
  const customDomain = customDomainOption(plan);
  const addOnSelected = customDomain.available && input.customDomain === true && !customDomain.included;
  const addOnPrice = addOnSelected ? Number(customDomain.price) : 0;
  let checkoutPrice: string | { toString(): string } = (Number((plan.price ?? plan.monthlyPrice).toString()) + addOnPrice).toFixed(2);
  let coupon: Awaited<ReturnType<typeof validateTenantCoupon>> | null = null;
  if (input.couponCode) {
    coupon = await validateTenantCoupon({ code: input.couponCode, planId: plan.id, interval, additionalPrice: addOnPrice });
    checkoutPrice = coupon.total;
  }
  const existing = await db.subscription.findFirst({ where: { churchId: church.id, planId: plan.id, interval, status: SubscriptionStatus.INCOMPLETE }, orderBy: { updatedAt: "desc" }, select: { id: true, status: true, provider: true, interval: true, externalSubscriptionId: true } });
  if (existing) await db.subscription.update({ where: { id: existing.id }, data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() } });
  if (coupon && Number(coupon.total) === 0) {
    const subscription = await db.subscription.create({ data: { churchId: church.id, planId: plan.id, provider, interval, status: SubscriptionStatus.ACTIVE }, select: { id: true, status: true, provider: true, interval: true } });
    await db.church.update({ where: { id: church.id }, data: { lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE", status: "ACTIVE" } });
    await db.promotionRedemption.create({ data: { promotionId: coupon.couponId, churchId: church.id, subscriptionId: subscription.id } });
    await db.promotion.update({ where: { id: coupon.couponId }, data: { redemptionCount: { increment: 1 } } });
    await logAudit({ activityType: "billing-subscription-initiation-requested", summary: `Activated a ${provider} subscription for ${plan.name} using a 100% coupon.`, actorId: actor.id, details: JSON.stringify({ boundary: "tenant-billing", churchId: church.id, targetType: "subscription", targetId: subscription.id, metadata: { provider, interval, paymentStatus: "NO_PAYMENT_REQUIRED", couponId: coupon.couponId } }) });
    return { ...subscription, reused: false, checkoutUrl: null, paymentStatus: "NO_PAYMENT_REQUIRED", couponApplied: true };
  }
  const subscription = await db.subscription.create({ data: { churchId: church.id, planId: plan.id, provider, interval, status: SubscriptionStatus.INCOMPLETE }, select: { id: true, status: true, provider: true, interval: true } });
  const checkout = provider === "STRIPE"
    ? await createStripeCheckout({ subscriptionId: subscription.id, planSlug: plan.slug, planName: plan.name, price: checkoutPrice, currency: plan.currency, interval, siteId: church.id })
    : await createPayPalSubscription({ subscriptionId: subscription.id, planSlug: plan.slug, planName: plan.name, price: checkoutPrice, currency: plan.currency, interval, siteId: church.id });
  await db.subscription.update({ where: { id: subscription.id }, data: { externalSubscriptionId: checkout.externalId } });
  await logAudit({ activityType: "billing-subscription-initiation-requested", summary: `Started a ${provider} subscription checkout request for ${plan.name}.`, actorId: actor.id, details: JSON.stringify({ boundary: "tenant-billing", churchId: church.id, targetType: "subscription", targetId: subscription.id, metadata: { provider, interval, paymentStatus: "PENDING_PROVIDER_CONFIRMATION" } }) });
  return { ...subscription, reused: false, checkoutUrl: checkout.checkoutUrl, paymentStatus: "PENDING_PROVIDER_CONFIRMATION" };
}
