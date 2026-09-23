import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ subscriptionPlan: { findMany: vi.fn(), findFirst: vi.fn() }, subscription: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() } }));
const requirePermission = vi.hoisted(() => vi.fn());
const requireCurrentChurch = vi.hoisted(() => vi.fn());
const logAudit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ requirePermission }));
vi.mock("@/lib/tenant", () => ({ requireCurrentChurch }));
vi.mock("@/lib/audit", () => ({ logAudit }));
vi.mock("@/lib/billing-providers", () => ({ createStripeCheckout: vi.fn(async () => ({ externalId: "cs_1", checkoutUrl: "https://checkout.example/cs_1" })), createPayPalSubscription: vi.fn(async () => ({ externalId: "sub_1", checkoutUrl: "https://paypal.example/approve" })) }));

describe("tenant billing initiation", () => {
  beforeEach(() => { vi.clearAllMocks(); requirePermission.mockResolvedValue({ id: "admin" }); requireCurrentChurch.mockResolvedValue({ church: { id: "church-1" } }); });
  it("serializes plan prices and exposes provider configuration without secrets", async () => {
    db.subscriptionPlan.findMany.mockResolvedValue([{ id: "plan-1", name: "Standard", slug: "standard", description: null, monthlyPrice: { toString: () => "10.00" }, annualPrice: { toString: () => "100.00" }, currency: "USD", stripeEnabled: true, paypalEnabled: true }]);
    const { listAvailableBillingPlans } = await import("@/lib/billing");
    const plans = await listAvailableBillingPlans();
    expect(plans[0]).toMatchObject({ monthlyPrice: "10.00", providers: { STRIPE: false, PAYPAL: false } });
    expect(JSON.stringify(plans)).not.toContain("SECRET");
  });
  it("reuses an incomplete initiation idempotently", async () => {
    process.env.STRIPE_SECRET_KEY = "test";
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", name: "Standard", stripeEnabled: true, paypalEnabled: true });
    db.subscription.findFirst.mockResolvedValue({ id: "sub-1", status: "INCOMPLETE", provider: "STRIPE", interval: "MONTHLY" });
    const { initiateBillingSubscription } = await import("@/lib/billing");
    await expect(initiateBillingSubscription({ planId: "plan-1", provider: "STRIPE", interval: "MONTHLY" })).resolves.toMatchObject({ id: "sub-1", reused: true, paymentStatus: "PENDING_PROVIDER_CONFIRMATION" });
    expect(db.subscription.create).not.toHaveBeenCalled();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("creates a provider checkout boundary without marking payment successful", async () => {
    process.env.STRIPE_SECRET_KEY = "test";
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", slug: "standard", name: "Standard", stripeEnabled: true, paypalEnabled: true });
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.create.mockResolvedValue({ id: "sub-2", status: "INCOMPLETE", provider: "STRIPE", interval: "MONTHLY" });
    const { initiateBillingSubscription } = await import("@/lib/billing");
    await expect(initiateBillingSubscription({ planId: "plan-1", provider: "STRIPE", interval: "MONTHLY" })).resolves.toMatchObject({ checkoutUrl: "https://checkout.example/cs_1", paymentStatus: "PENDING_PROVIDER_CONFIRMATION" });
    expect(db.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: { externalSubscriptionId: "cs_1" } }));
    delete process.env.STRIPE_SECRET_KEY;
  });
});
