import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ subscriptionPlan: { findMany: vi.fn(), findFirst: vi.fn() }, subscription: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }, promotionRedemption: { create: vi.fn() }, promotion: { update: vi.fn() }, church: { update: vi.fn() } }));
const requirePermission = vi.hoisted(() => vi.fn());
const requireCurrentChurch = vi.hoisted(() => vi.fn());
const logAudit = vi.hoisted(() => vi.fn());
const validateTenantCoupon = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ requirePermission }));
vi.mock("@/lib/tenant", () => ({ requireCurrentChurch }));
vi.mock("@/lib/audit", () => ({ logAudit }));
vi.mock("@/lib/billing-coupons", () => ({ validateTenantCoupon }));
const performProviderBillingAction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/billing-providers", () => ({ createStripeCheckout: vi.fn(async () => ({ externalId: "cs_1", checkoutUrl: "https://checkout.example/cs_1" })), createPayPalSubscription: vi.fn(async () => ({ externalId: "sub_1", checkoutUrl: "https://paypal.example/approve" })), performProviderBillingAction }));

describe("tenant billing initiation", () => {
  beforeEach(() => { vi.clearAllMocks(); requirePermission.mockResolvedValue({ id: "admin" }); requireCurrentChurch.mockResolvedValue({ user: { id: "admin" }, church: { id: "church-1" } }); });
  it("serializes plan prices and exposes provider configuration without secrets", async () => {
    db.subscriptionPlan.findMany.mockResolvedValue([{ id: "plan-1", name: "Standard", slug: "standard", description: null, monthlyPrice: { toString: () => "10.00" }, annualPrice: { toString: () => "100.00" }, currency: "USD", stripeEnabled: true, paypalEnabled: true }]);
    const { listAvailableBillingPlans } = await import("@/lib/billing");
    const plans = await listAvailableBillingPlans();
    expect(requireCurrentChurch).toHaveBeenCalledWith({ allowUnsubscribed: true });
    expect(plans[0]).toMatchObject({ monthlyPrice: "10.00", providers: { STRIPE: false, PAYPAL: false } });
    expect(JSON.stringify(plans)).not.toContain("SECRET");
  });
  it("exposes a paid custom-domain entitlement to the tenant plan selector", async () => {
    db.subscriptionPlan.findMany.mockResolvedValue([{
      id: "plan-1",
      name: "Standard",
      slug: "standard",
      description: null,
      price: { toString: () => "20.00" },
      interval: "QUARTERLY",
      monthlyPrice: { toString: () => "20.00" },
      annualPrice: { toString: () => "80.00" },
      currency: "USD",
      stripeEnabled: true,
      paypalEnabled: true,
      entitlements: [{ mode: "PAID_ADD_ON", addOnMonthly: { toString: () => "25.00" }, addOnAnnual: { toString: () => "25.00" } }]
    }]);
    const { listAvailableBillingPlans } = await import("@/lib/billing");
    const plans = await listAvailableBillingPlans();
    expect(plans[0].customDomain).toEqual({ available: true, included: false, price: "25.00" });
  });
  it("restarts an incomplete initiation so checkout can be completed", async () => {
    process.env.STRIPE_SECRET_KEY = "test";
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", slug: "standard", name: "Standard", currency: "USD", price: { toString: () => "10.00" }, interval: "MONTHLY", stripeEnabled: true, paypalEnabled: true });
    db.subscription.findFirst.mockResolvedValue({ id: "sub-1", status: "INCOMPLETE", provider: "STRIPE", interval: "MONTHLY" });
    db.subscription.create.mockResolvedValue({ id: "sub-2", status: "INCOMPLETE", provider: "STRIPE", interval: "MONTHLY" });
    const { initiateBillingSubscription } = await import("@/lib/billing");
    await expect(initiateBillingSubscription({ planId: "plan-1", provider: "STRIPE", interval: "MONTHLY" })).resolves.toMatchObject({ id: "sub-2", reused: false, checkoutUrl: "https://checkout.example/cs_1", paymentStatus: "PENDING_PROVIDER_CONFIRMATION" });
    expect(requireCurrentChurch).toHaveBeenCalledWith({ allowUnsubscribed: true });
    expect(db.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "sub-1" }, data: expect.objectContaining({ status: "CANCELED" }) }));
    expect(db.subscription.create).toHaveBeenCalled();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("creates a provider checkout boundary without marking payment successful", async () => {
    process.env.STRIPE_SECRET_KEY = "test";
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", slug: "standard", name: "Standard", currency: "USD", price: { toString: () => "10.00" }, interval: "MONTHLY", stripeEnabled: true, paypalEnabled: true });
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.create.mockResolvedValue({ id: "sub-2", status: "INCOMPLETE", provider: "STRIPE", interval: "MONTHLY" });
    const { initiateBillingSubscription } = await import("@/lib/billing");
    await expect(initiateBillingSubscription({ planId: "plan-1", provider: "STRIPE", interval: "MONTHLY" })).resolves.toMatchObject({ checkoutUrl: "https://checkout.example/cs_1", paymentStatus: "PENDING_PROVIDER_CONFIRMATION" });
    expect(db.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: { externalSubscriptionId: "cs_1" } }));
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("activates a 100% coupon without contacting a payment provider", async () => {
    process.env.PAYPAL_CLIENT_ID = "client";
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", slug: "standard", name: "Standard", currency: "USD", price: { toString: () => "10.00" }, interval: "MONTHLY", stripeEnabled: true, paypalEnabled: true });
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.create.mockResolvedValue({ id: "sub-free", status: "ACTIVE", provider: "PAYPAL", interval: "MONTHLY" });
    const { initiateBillingSubscription } = await import("@/lib/billing");
    const { createPayPalSubscription } = await import("@/lib/billing-providers");
    validateTenantCoupon.mockResolvedValue({ couponId: "promo-full", code: "FULL", discountType: "PERCENTAGE", subtotal: "10.00", discount: "10.00", total: "0.00", currency: "USD" });
    await expect(initiateBillingSubscription({ planId: "plan-1", provider: "PAYPAL", interval: "MONTHLY", couponCode: "FULL" })).resolves.toMatchObject({ status: "ACTIVE", paymentStatus: "NO_PAYMENT_REQUIRED", couponApplied: true });
    expect(createPayPalSubscription).not.toHaveBeenCalled();
    expect(db.promotionRedemption.create).toHaveBeenCalledWith({ data: { promotionId: "promo-full", churchId: "church-1", subscriptionId: "sub-free" } });
    expect(db.promotion.update).toHaveBeenCalledWith({ where: { id: "promo-full" }, data: { redemptionCount: { increment: 1 } } });
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  it("includes the paid custom-domain add-on in the checkout quote", async () => {
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", name: "Standard", currency: "USD", price: { toString: () => "20.00" }, interval: "QUARTERLY", monthlyPrice: { toString: () => "20.00" }, annualPrice: { toString: () => "80.00" }, entitlements: [{ mode: "PAID_ADD_ON", addOnMonthly: { toString: () => "3.00" }, addOnAnnual: { toString: () => "3.00" } }] });
    const { getBillingQuote } = await import("@/lib/billing");
    await expect(getBillingQuote({ planId: "plan-1", provider: "STRIPE", interval: "QUARTERLY", customDomain: true })).resolves.toMatchObject({ planPrice: 20, addOnPrice: 3, addOnSelected: true, subtotal: "23.00", total: "23.00" });
  });
  it("supports the three billing domain choices and only charges for a new domain", async () => {
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", name: "Standard", currency: "USD", price: { toString: () => "20.00" }, interval: "QUARTERLY", monthlyPrice: { toString: () => "20.00" }, annualPrice: { toString: () => "80.00" }, entitlements: [{ mode: "PAID_ADD_ON", addOnMonthly: { toString: () => "3.00" }, addOnAnnual: { toString: () => "3.00" } }] });
    const { getBillingQuote } = await import("@/lib/billing");
    await expect(getBillingQuote({ planId: "plan-1", provider: "STRIPE", interval: "QUARTERLY", domainChoice: "OWN_DOMAIN", domainHostname: "www.example.org" })).resolves.toMatchObject({ domainChoice: "OWN_DOMAIN", domainHostname: "www.example.org", addOnPrice: 0, addOnSelected: false, subtotal: "20.00" });
    await expect(getBillingQuote({ planId: "plan-1", provider: "STRIPE", interval: "QUARTERLY", domainChoice: "NEW_DOMAIN", domainHostname: "example.org" })).resolves.toMatchObject({ domainChoice: "NEW_DOMAIN", domainHostname: "example.org", addOnPrice: 3, addOnSelected: true, subtotal: "23.00" });
    await expect(getBillingQuote({ planId: "plan-1", provider: "STRIPE", interval: "QUARTERLY", domainChoice: "NEW_DOMAIN", domainHostname: "example.org", domainRegistrationPrice: 8 })).resolves.toMatchObject({ addOnPrice: 8, subtotal: "28.00" });
    await expect(getBillingQuote({ planId: "plan-1", provider: "STRIPE", interval: "QUARTERLY", domainChoice: "OWN_DOMAIN" })).rejects.toThrow("valid domain name");
  });
  it("applies coupons to the subscription price but not the annual domain fee", async () => {
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", name: "Standard", currency: "USD", price: { toString: () => "20.00" }, interval: "QUARTERLY", monthlyPrice: { toString: () => "20.00" }, annualPrice: { toString: () => "80.00" }, entitlements: [{ mode: "PAID_ADD_ON", addOnMonthly: { toString: () => "25.00" }, addOnAnnual: { toString: () => "25.00" } }] });
    validateTenantCoupon.mockResolvedValue({ couponId: "promo-1", code: "HALF", discount: "10.00", total: "10.00" });
    const { getBillingQuote } = await import("@/lib/billing");
    await expect(getBillingQuote({ planId: "plan-1", provider: "STRIPE", interval: "QUARTERLY", couponCode: "HALF", domainChoice: "NEW_DOMAIN", domainHostname: "example.org" })).resolves.toMatchObject({ planPrice: 20, addOnPrice: 25, subtotal: "45.00", discount: "10.00", total: "35.00" });
    expect(validateTenantCoupon).toHaveBeenCalledWith({ code: "HALF", planId: "plan-1", interval: "QUARTERLY", additionalPrice: 0 });
  });
  it("creates a separate annual provider authorization for the domain fee", async () => {
    process.env.STRIPE_SECRET_KEY = "test";
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", slug: "standard", name: "Standard", currency: "USD", price: { toString: () => "20.00" }, interval: "MONTHLY", monthlyPrice: { toString: () => "20.00" }, annualPrice: { toString: () => "240.00" }, stripeEnabled: true, paypalEnabled: true, entitlements: [{ mode: "PAID_ADD_ON", addOnMonthly: { toString: () => "25.00" }, addOnAnnual: { toString: () => "25.00" } }] });
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.create.mockResolvedValue({ id: "sub-annual-addon", status: "INCOMPLETE", provider: "STRIPE", interval: "MONTHLY" });
    const { initiateBillingSubscription } = await import("@/lib/billing");
    const { createStripeCheckout } = await import("@/lib/billing-providers");
    vi.mocked(createStripeCheckout).mockResolvedValueOnce({ externalId: "base-checkout", checkoutUrl: "https://checkout.example/base" }).mockResolvedValueOnce({ externalId: "domain-checkout", checkoutUrl: "https://checkout.example/domain" });
    await expect(initiateBillingSubscription({ planId: "plan-1", provider: "STRIPE", interval: "MONTHLY", domainChoice: "NEW_DOMAIN", domainHostname: "example.org" })).resolves.toMatchObject({ checkoutUrl: "https://checkout.example/base", domainCheckoutUrl: "https://checkout.example/domain" });
    expect(createStripeCheckout).toHaveBeenNthCalledWith(1, expect.objectContaining({ price: "20.00", interval: "MONTHLY", component: "BASE" }));
    expect(createStripeCheckout).toHaveBeenNthCalledWith(2, expect.objectContaining({ price: "25.00", interval: "ANNUAL", component: "DOMAIN_ADD_ON" }));
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("schedules active subscription cancellation at period end", async () => {
    db.subscription.findFirst.mockResolvedValue({ id: "sub-1", provider: "STRIPE", externalSubscriptionId: "stripe-sub-1", cancelAtPeriodEnd: false, plan: { name: "Standard" } });
    db.subscription.update.mockResolvedValue({ cancelAtPeriodEnd: true, currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z") });
    performProviderBillingAction.mockResolvedValue({ status: "ACTIVE", cancelAtPeriodEnd: true });
    const { cancelCurrentBillingSubscription } = await import("@/lib/billing");
    await expect(cancelCurrentBillingSubscription()).resolves.toMatchObject({ cancelAtPeriodEnd: true, currentPeriodEnd: "2027-01-01T00:00:00.000Z" });
    expect(performProviderBillingAction).toHaveBeenCalledWith("STRIPE", "stripe-sub-1", "CANCEL_AT_PERIOD_END");
    expect(db.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: { cancelAtPeriodEnd: true } }));
  });
});
