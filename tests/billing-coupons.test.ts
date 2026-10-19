import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ subscriptionPlan: { findFirst: vi.fn() }, promotion: { findUnique: vi.fn() } }));
const requirePermission = vi.hoisted(() => vi.fn());
const requireCurrentChurch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ requirePermission }));
vi.mock("@/lib/tenant", () => ({ requireCurrentChurch }));

describe("tenant coupon validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue({ id: "tenant-admin" });
    requireCurrentChurch.mockResolvedValue({ church: { id: "church-1" } });
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", currency: "USD", price: { toString: () => "20.00" }, interval: "QUARTERLY", monthlyPrice: { toString: () => "20.00" }, annualPrice: { toString: () => "200.00" } });
  });
  it("previews a valid 100% coupon and rejects expired, limited, inactive, and wrong-currency coupons", async () => {
    const { validateTenantCoupon } = await import("@/lib/billing-coupons");
    const base = { id: "promo-1", code: "FULL", isActive: true, discountType: "PERCENTAGE", percentageOff: 100, amountOff: null, currency: "USD", startsAt: new Date(Date.now() - 1000), endsAt: null, appliesMonthly: true, appliesQuarterly: true, appliesSemiAnnual: true, appliesAnnual: true, maxRedemptions: null, redemptionCount: 0, maxPerAccount: 1, redemptions: [] };
    db.promotion.findUnique.mockResolvedValue(base);
    await expect(validateTenantCoupon({ code: "full", planId: "plan-1", interval: "QUARTERLY" })).resolves.toMatchObject({ couponId: "promo-1", discount: "20.00", total: "0.00" });
    expect(requireCurrentChurch).toHaveBeenCalledWith({ allowUnsubscribed: true });
    db.promotion.findUnique.mockResolvedValue({ ...base, endsAt: new Date(Date.now() - 1000) });
    await expect(validateTenantCoupon({ code: "full", planId: "plan-1", interval: "QUARTERLY" })).rejects.toThrow("invalid or expired");
    db.promotion.findUnique.mockResolvedValue({ ...base, endsAt: null, maxRedemptions: 1, redemptionCount: 1 });
    await expect(validateTenantCoupon({ code: "full", planId: "plan-1", interval: "QUARTERLY" })).rejects.toThrow("usage limit");
    db.promotion.findUnique.mockResolvedValue({ ...base, endsAt: null, isActive: false });
    await expect(validateTenantCoupon({ code: "full", planId: "plan-1", interval: "QUARTERLY" })).rejects.toThrow("invalid or expired");
    db.promotion.findUnique.mockResolvedValue({ ...base, endsAt: null, currency: "EUR" });
    await expect(validateTenantCoupon({ code: "full", planId: "plan-1", interval: "QUARTERLY" })).rejects.toThrow("plan currency");
  });
  it("handles fixed discounts and interval applicability", async () => {
    const { validateTenantCoupon } = await import("@/lib/billing-coupons");
    db.subscriptionPlan.findFirst.mockResolvedValue({ id: "plan-1", currency: "USD", price: { toString: () => "200.00" }, interval: "ANNUAL", monthlyPrice: { toString: () => "20.00" }, annualPrice: { toString: () => "200.00" } });
    db.promotion.findUnique.mockResolvedValue({ id: "promo-2", code: "FIXED", isActive: true, discountType: "FIXED_AMOUNT", percentageOff: null, amountOff: { toString: () => "5.00" }, currency: "USD", startsAt: new Date(Date.now() - 1000), endsAt: null, appliesMonthly: false, appliesQuarterly: false, appliesSemiAnnual: false, appliesAnnual: true, maxRedemptions: null, redemptionCount: 0, maxPerAccount: 1, redemptions: [] });
    await expect(validateTenantCoupon({ code: "fixed", planId: "plan-1", interval: "ANNUAL" })).resolves.toMatchObject({ discount: "5.00", total: "195.00" });
    await expect(validateTenantCoupon({ code: "fixed", planId: "plan-1", interval: "MONTHLY" })).rejects.toThrow("billing interval");
  });
});
