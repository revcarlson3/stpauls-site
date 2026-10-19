import { BillingInterval, BillingProvider, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireCurrentChurch } from "@/lib/tenant";
import { createPayPalSubscription, createStripeCheckout } from "@/lib/billing-providers";
import { providerConfiguredWithStored } from "@/lib/billing-config";
import { validateTenantCoupon } from "@/lib/billing-coupons";
import { normalizeHostname } from "@/lib/global-admin-domains";

export type BillingDomainChoice = "PLATFORM_SUBDOMAIN" | "OWN_DOMAIN" | "NEW_DOMAIN";

function resolveDomainChoice(input: { domainChoice?: unknown; domainHostname?: unknown; customDomain?: unknown }, customDomain: { available: boolean; included: boolean }) {
  const legacyChoice = input.domainChoice === undefined;
  const choice: BillingDomainChoice = input.domainChoice === undefined
    ? input.customDomain === true ? "NEW_DOMAIN" : "PLATFORM_SUBDOMAIN"
    : input.domainChoice as BillingDomainChoice;
  if (!["PLATFORM_SUBDOMAIN", "OWN_DOMAIN", "NEW_DOMAIN"].includes(choice)) throw new Error("Choose a valid domain option.");
  if (!legacyChoice && (choice === "OWN_DOMAIN" || choice === "NEW_DOMAIN") && !normalizeHostname(input.domainHostname)) {
    throw new Error("Provide a valid domain name for the selected domain option.");
  }
  if (choice === "NEW_DOMAIN" && !customDomain.available) {
    throw new Error("New domain registration is not available for the selected plan.");
  }
  return { choice, hostname: choice === "PLATFORM_SUBDOMAIN" ? null : normalizeHostname(input.domainHostname) };
}

export async function getCurrentBillingSubscription() {
  const { church } = await requireCurrentChurch({ allowUnsubscribed: true });
  const subscription = await db.subscription.findFirst({
    where: { churchId: church.id, status: SubscriptionStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, provider: true, interval: true, status: true, currentPeriodStart: true,
      currentPeriodEnd: true, cancelAtPeriodEnd: true, canceledAt: true,
      plan: { select: { name: true, currency: true, price: true, monthlyPrice: true, annualPrice: true } }
    }
  });
  if (!subscription) return null;
  return {
    ...subscription,
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    canceledAt: subscription.canceledAt?.toISOString() ?? null,
    plan: {
      ...subscription.plan,
      price: (subscription.plan.price ?? (subscription.interval === "ANNUAL" ? subscription.plan.annualPrice : subscription.plan.monthlyPrice)).toString()
    }
  };
}

export async function cancelCurrentBillingSubscription() {
  const { user: actor, church } = await requireCurrentChurch({ allowUnsubscribed: true });
  const subscription = await db.subscription.findFirst({
    where: { churchId: church.id, status: SubscriptionStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
    select: { id: true, provider: true, externalSubscriptionId: true, cancelAtPeriodEnd: true, plan: { select: { name: true } } }
  });
  if (!subscription) throw new Error("No active subscription was found.");
  if (subscription.cancelAtPeriodEnd) return { cancelAtPeriodEnd: true };
  if (!subscription.externalSubscriptionId) {
    throw new Error("This subscription does not have a provider cancellation schedule.");
  }
  const { performProviderBillingAction } = await import("@/lib/billing-providers");
  const providerState = await performProviderBillingAction(subscription.provider, subscription.externalSubscriptionId, "CANCEL_AT_PERIOD_END");
  const updated = await db.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true },
    select: { cancelAtPeriodEnd: true, currentPeriodEnd: true }
  });
  await logAudit({
    activityType: "billing-subscription-action",
    summary: `Scheduled cancellation of the ${subscription.plan.name} subscription at period end.`,
    actorId: actor.id,
    details: JSON.stringify({ boundary: "tenant-billing", churchId: church.id, targetType: "subscription", targetId: subscription.id, metadata: { provider: subscription.provider, providerStatus: providerState.status } })
  });
  return { cancelAtPeriodEnd: updated.cancelAtPeriodEnd, currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null };
}

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

export async function getBillingQuote(input: { planId: unknown; provider: unknown; interval?: unknown; couponCode?: unknown; customDomain?: unknown; domainChoice?: unknown; domainHostname?: unknown; domainRegistrationPrice?: unknown }) {
  await requireCurrentChurch({ allowUnsubscribed: true });
  if (input.provider !== "STRIPE" && input.provider !== "PAYPAL") throw new Error("Unsupported billing provider.");
  if (typeof input.planId !== "string" || !input.planId) throw new Error("A billing plan is required.");
  const plan = await db.subscriptionPlan.findFirst({ where: { id: input.planId, isActive: true }, select: { id: true, name: true, currency: true, price: true, interval: true, monthlyPrice: true, annualPrice: true, entitlements: { where: { moduleSlug: "custom-domains" }, select: { mode: true, addOnMonthly: true, addOnAnnual: true } } } });
  if (!plan) throw new Error("Billing plan is unavailable.");
  const interval = (plan.interval ?? "MONTHLY") as BillingInterval;
  if (input.interval && input.interval !== interval) throw new Error("The selected plan has a fixed billing interval.");
  const customDomain = customDomainOption(plan);
  const domain = resolveDomainChoice(input, customDomain);
  const addOnSelected = domain.choice === "NEW_DOMAIN" && customDomain.available && !customDomain.included;
  const registrationPrice = typeof input.domainRegistrationPrice === "number" && Number.isFinite(input.domainRegistrationPrice) && input.domainRegistrationPrice >= 0 ? input.domainRegistrationPrice : 0;
  const addOnPrice = addOnSelected ? Math.max(Number(customDomain.price), registrationPrice) : 0;
  const planPrice = Number((plan.price ?? (interval === "MONTHLY" ? plan.monthlyPrice : plan.annualPrice)).toString());
  const subtotal = planPrice + addOnPrice;
  const coupon = input.couponCode ? await validateTenantCoupon({ code: input.couponCode, planId: plan.id, interval, additionalPrice: 0 }) : null;
  const total = coupon ? (Number(coupon.total) + addOnPrice).toFixed(2) : subtotal.toFixed(2);
  return { planId: plan.id, planName: plan.name, provider: input.provider, interval, currency: plan.currency, planPrice, addOnPrice, addOnSelected, domainChoice: domain.choice, domainHostname: domain.hostname, subtotal: subtotal.toFixed(2), discount: coupon?.discount ?? "0.00", total, couponCode: coupon?.code ?? null, customDomain };
}

export async function initiateBillingSubscription(input: { planId: unknown; provider: unknown; interval?: unknown; couponCode?: unknown; customDomain?: unknown; domainChoice?: unknown; domainHostname?: unknown; domainRegistrationPrice?: unknown }) {
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
  const domain = resolveDomainChoice(input, customDomain);
  const addOnSelected = domain.choice === "NEW_DOMAIN" && customDomain.available && !customDomain.included;
  const registrationPrice = typeof input.domainRegistrationPrice === "number" && Number.isFinite(input.domainRegistrationPrice) && input.domainRegistrationPrice >= 0 ? input.domainRegistrationPrice : 0;
  const addOnPrice = addOnSelected ? Math.max(Number(customDomain.price), registrationPrice) : 0;
  let checkoutPrice: string | { toString(): string } = Number((plan.price ?? plan.monthlyPrice).toString()).toFixed(2);
  let coupon: Awaited<ReturnType<typeof validateTenantCoupon>> | null = null;
  if (input.couponCode) {
    coupon = await validateTenantCoupon({ code: input.couponCode, planId: plan.id, interval, additionalPrice: 0 });
    checkoutPrice = coupon.total;
  }
  const existing = await db.subscription.findFirst({ where: { churchId: church.id, planId: plan.id, interval, status: SubscriptionStatus.INCOMPLETE }, orderBy: { updatedAt: "desc" }, select: { id: true, status: true, provider: true, interval: true, externalSubscriptionId: true } });
  if (existing) await db.subscription.update({ where: { id: existing.id }, data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() } });
  if (coupon && Number(coupon.total) === 0) {
    const subscription = await db.subscription.create({ data: { churchId: church.id, planId: plan.id, provider, interval, status: SubscriptionStatus.ACTIVE, domainAddonPrice: addOnSelected ? addOnPrice : null, domainAddonHostname: addOnSelected ? domain.hostname : null, domainAddonProvider: addOnSelected ? provider : null, domainAddonStatus: addOnSelected ? "INCOMPLETE" : null }, select: { id: true, status: true, provider: true, interval: true } });
    await db.church.update({ where: { id: church.id }, data: { lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE", status: "ACTIVE" } });
    await db.promotionRedemption.create({ data: { promotionId: coupon.couponId, churchId: church.id, subscriptionId: subscription.id } });
    await db.promotion.update({ where: { id: coupon.couponId }, data: { redemptionCount: { increment: 1 } } });
    const domainCheckout = addOnSelected
      ? provider === "STRIPE"
        ? await createStripeCheckout({ subscriptionId: subscription.id, planSlug: `${plan.slug}-domain-addon`, planName: plan.name, price: addOnPrice.toFixed(2), currency: plan.currency, interval: "ANNUAL", siteId: church.id, component: "DOMAIN_ADD_ON" })
        : await createPayPalSubscription({ subscriptionId: subscription.id, planSlug: `${plan.slug}-domain-addon`, planName: plan.name, price: addOnPrice.toFixed(2), currency: plan.currency, interval: "ANNUAL", siteId: church.id, component: "DOMAIN_ADD_ON" })
      : null;
    if (domainCheckout) await db.subscription.update({ where: { id: subscription.id }, data: { domainAddonExternalId: domainCheckout.externalId } });
    await logAudit({ activityType: "billing-subscription-initiation-requested", summary: `Activated a ${provider} subscription for ${plan.name} using a 100% coupon.`, actorId: actor.id, details: JSON.stringify({ boundary: "tenant-billing", churchId: church.id, targetType: "subscription", targetId: subscription.id, metadata: { provider, interval, paymentStatus: "NO_PAYMENT_REQUIRED", couponId: coupon.couponId, domainChoice: domain.choice, domainHostname: domain.hostname } }) });
    return { ...subscription, reused: false, checkoutUrl: null, domainCheckoutUrl: domainCheckout?.checkoutUrl ?? null, paymentStatus: "NO_PAYMENT_REQUIRED", couponApplied: true };
  }
  const subscription = await db.subscription.create({ data: { churchId: church.id, planId: plan.id, provider, interval, status: SubscriptionStatus.INCOMPLETE, domainAddonPrice: addOnSelected ? addOnPrice : null, domainAddonHostname: addOnSelected ? domain.hostname : null, domainAddonProvider: addOnSelected ? provider : null, domainAddonStatus: addOnSelected ? "INCOMPLETE" : null }, select: { id: true, status: true, provider: true, interval: true } });
  const checkout = provider === "STRIPE"
    ? await createStripeCheckout({ subscriptionId: subscription.id, planSlug: plan.slug, planName: plan.name, price: checkoutPrice, currency: plan.currency, interval, siteId: church.id, component: "BASE" })
    : await createPayPalSubscription({ subscriptionId: subscription.id, planSlug: plan.slug, planName: plan.name, price: checkoutPrice, currency: plan.currency, interval, siteId: church.id, component: "BASE" });
  const domainCheckout = addOnSelected
    ? provider === "STRIPE"
      ? await createStripeCheckout({ subscriptionId: subscription.id, planSlug: `${plan.slug}-domain-addon`, planName: plan.name, price: addOnPrice.toFixed(2), currency: plan.currency, interval: "ANNUAL", siteId: church.id, component: "DOMAIN_ADD_ON" })
      : await createPayPalSubscription({ subscriptionId: subscription.id, planSlug: `${plan.slug}-domain-addon`, planName: plan.name, price: addOnPrice.toFixed(2), currency: plan.currency, interval: "ANNUAL", siteId: church.id, component: "DOMAIN_ADD_ON" })
    : null;
  await db.subscription.update({ where: { id: subscription.id }, data: { externalSubscriptionId: checkout.externalId, ...(domainCheckout ? { domainAddonExternalId: domainCheckout.externalId } : {}) } });
  await logAudit({ activityType: "billing-subscription-initiation-requested", summary: `Started a ${provider} subscription checkout request for ${plan.name}.`, actorId: actor.id, details: JSON.stringify({ boundary: "tenant-billing", churchId: church.id, targetType: "subscription", targetId: subscription.id, metadata: { provider, interval, paymentStatus: "PENDING_PROVIDER_CONFIRMATION", domainChoice: domain.choice, domainHostname: domain.hostname } }) });
  return { ...subscription, reused: false, checkoutUrl: checkout.checkoutUrl, domainCheckoutUrl: domainCheckout?.checkoutUrl ?? null, paymentStatus: "PENDING_PROVIDER_CONFIRMATION" };
}

export async function initiateExistingSubscriptionDomainAddon(input: { hostname: unknown; registrationPrice?: unknown }) {
  const { user: actor, church } = await requireCurrentChurch({ allowUnsubscribed: false });
  const hostname = normalizeHostname(input.hostname);
  if (!hostname) throw new Error("Provide a valid domain name.");
  const subscription = await db.subscription.findFirst({
    where: { churchId: church.id, status: SubscriptionStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, provider: true, interval: true, domainAddonStatus: true,
      plan: { select: { id: true, slug: true, name: true, currency: true, stripeEnabled: true, paypalEnabled: true, entitlements: { where: { moduleSlug: "custom-domains" }, select: { mode: true, addOnMonthly: true, addOnAnnual: true } } } }
    }
  });
  if (!subscription) throw new Error("An active subscription is required to purchase a new domain.");
  if (subscription.domainAddonStatus === "ACTIVE" || subscription.domainAddonStatus === "INCOMPLETE") throw new Error("A domain add-on authorization is already active or pending.");
  const customDomain = customDomainOption({ interval: subscription.interval, entitlements: subscription.plan.entitlements });
  if (!customDomain.available) throw new Error("New domain registration is not available on this plan.");
  const registrationPrice = typeof input.registrationPrice === "number" && Number.isFinite(input.registrationPrice) && input.registrationPrice >= 0 ? input.registrationPrice : 0;
  const price = customDomain.included ? 0 : Math.max(Number(customDomain.price), registrationPrice);
  if (price === 0) {
    await db.subscription.update({ where: { id: subscription.id }, data: { domainAddonPrice: 0, domainAddonHostname: hostname, domainAddonProvider: subscription.provider, domainAddonStatus: "ACTIVE" } });
    return { subscriptionId: subscription.id, checkoutUrl: null, price: "0.00", currency: subscription.plan.currency, included: true };
  }
  const provider = subscription.provider;
  if ((provider === "STRIPE" && !subscription.plan.stripeEnabled) || (provider === "PAYPAL" && !subscription.plan.paypalEnabled) || !await providerConfiguredWithStored(provider)) throw new Error(`${provider} billing is not configured for this plan.`);
  const checkout = provider === "STRIPE"
    ? await createStripeCheckout({ subscriptionId: subscription.id, planSlug: `${subscription.plan.slug}-domain-addon`, planName: subscription.plan.name, price: price.toFixed(2), currency: subscription.plan.currency, interval: "ANNUAL", siteId: church.id, component: "DOMAIN_ADD_ON" })
    : await createPayPalSubscription({ subscriptionId: subscription.id, planSlug: `${subscription.plan.slug}-domain-addon`, planName: subscription.plan.name, price: price.toFixed(2), currency: subscription.plan.currency, interval: "ANNUAL", siteId: church.id, component: "DOMAIN_ADD_ON" });
  await db.subscription.update({ where: { id: subscription.id }, data: { domainAddonPrice: price, domainAddonHostname: hostname, domainAddonExternalId: checkout.externalId, domainAddonProvider: provider, domainAddonStatus: "INCOMPLETE" } });
  await logAudit({ activityType: "billing-subscription-initiation-requested", summary: `Started annual domain add-on authorization for ${hostname}.`, actorId: actor.id, details: JSON.stringify({ boundary: "tenant-billing", churchId: church.id, targetType: "subscription", targetId: subscription.id, metadata: { provider, hostname, price, currency: subscription.plan.currency, component: "DOMAIN_ADD_ON" } }) });
  return { subscriptionId: subscription.id, checkoutUrl: checkout.checkoutUrl, price: price.toFixed(2), currency: subscription.plan.currency, included: false };
}

export async function getExistingSubscriptionDomainAddonPricing() {
  const { church } = await requireCurrentChurch({ allowUnsubscribed: false });
  const subscription = await db.subscription.findFirst({
    where: { churchId: church.id, status: SubscriptionStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
    select: { interval: true, domainAddonHostname: true, domainAddonStatus: true, plan: { select: { currency: true, entitlements: { where: { moduleSlug: "custom-domains" }, select: { mode: true, addOnMonthly: true, addOnAnnual: true } } } } }
  });
  if (!subscription) return { available: false, included: false, price: "0.00", currency: "USD", purchasedDomain: null };
  const option = customDomainOption({ interval: subscription.interval, entitlements: subscription.plan.entitlements });
  const purchasedDomain = subscription.domainAddonHostname && ["ACTIVE", "INCOMPLETE"].includes(subscription.domainAddonStatus ?? "")
    ? { hostname: subscription.domainAddonHostname, status: subscription.domainAddonStatus }
    : null;
  return { available: option.available, included: option.included, price: option.price, currency: subscription.plan.currency, purchasedDomain };
}
