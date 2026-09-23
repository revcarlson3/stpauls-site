import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ billingProviderConfiguration: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() }, promotion: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() } }));
const requireGlobalAdmin = vi.hoisted(() => vi.fn());
const logAudit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/global-admin", () => ({ requireGlobalAdmin, buildGlobalAuditDetails: vi.fn(() => "details") }));
vi.mock("@/lib/audit", () => ({ logAudit }));
describe("billing configuration and coupons", () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.BILLING_CONFIG_MASTER_KEY = "a".repeat(64); requireGlobalAdmin.mockResolvedValue({ user: { id: "admin" } }); });
  it("encrypts secrets and never exposes their plaintext", async () => {
    const { encryptBillingSecret, decryptBillingSecret, billingConfigStatus } = await import("@/lib/billing-config");
    const encrypted = encryptBillingSecret("super-secret");
    expect(encrypted).not.toContain("super-secret");
    expect(decryptBillingSecret(encrypted)).toBe("super-secret");
    db.billingProviderConfiguration.findMany.mockResolvedValue([{ provider: "STRIPE", environment: "TEST", stripeSecretKeyEncrypted: encrypted, stripeWebhookSecretEncrypted: null, paypalClientIdEncrypted: null, paypalClientSecretEncrypted: null, paypalWebhookIdEncrypted: null, paypalApiBaseUrl: null, updatedAt: new Date() }]);
    expect(await billingConfigStatus()).toEqual([expect.objectContaining({ configured: true, webhookConfigured: false })]);
    expect(JSON.stringify(await billingConfigStatus())).not.toContain("super-secret");
  });
  it("rejects invalid or mutually exclusive coupon discounts and dates", async () => {
    const { validateCouponInput } = await import("@/lib/global-admin-coupons");
    expect(() => validateCouponInput({ code: "BAD", discountType: "PERCENTAGE", percentageOff: 10, amountOff: 2 })).toThrow();
    expect(() => validateCouponInput({ code: "GOOD", discountType: "PERCENTAGE", percentageOff: 101 })).toThrow();
    expect(() => validateCouponInput({ code: "GOOD", discountType: "FIXED_AMOUNT", amountOff: 5, startsAt: "2026-02-01", endsAt: "2026-01-01" })).toThrow();
    expect(validateCouponInput({ code: "good-code", discountType: "FIXED_AMOUNT", amountOff: "5.00" })).toMatchObject({ code: "GOOD-CODE", currency: "USD" });
  });
  it("creates coupons through the sensitive audited global-admin boundary", async () => {
    db.promotion.create.mockResolvedValue({ id: "coupon-1", code: "WELCOME", name: "WELCOME", discountType: "PERCENTAGE", percentageOff: 10, amountOff: null, currency: "USD", startsAt: new Date(), endsAt: null, appliesMonthly: true, appliesAnnual: true, isActive: true });
    const { createGlobalCoupon } = await import("@/lib/global-admin-coupons");
    await createGlobalCoupon({ code: "WELCOME", discountType: "PERCENTAGE", percentageOff: 10 });
    expect(requireGlobalAdmin).toHaveBeenCalledWith({ sensitive: true });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ activityType: "billing-coupon-changed" }));
  });
});
