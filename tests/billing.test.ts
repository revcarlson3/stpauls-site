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
vi.mock("@/lib/billing-providers", () => ({ createStripeCheckout: vi.fn(async () => ({ externalId: "cs_1", checkoutUrl: "https://checkout.example/cs_1" })), createPayPalSubscription: vi.fn(async () => ({ externalId: "sub_1", checkoutUrl: "https://paypal.example/approve" })) }));

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
});
