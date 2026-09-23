import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ subscription: { findUnique: vi.fn(), update: vi.fn() } }));
const requireGlobalAdmin = vi.hoisted(() => vi.fn());
const logAudit = vi.hoisted(() => vi.fn());
const performProviderBillingAction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/global-admin", () => ({ requireGlobalAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit }));
vi.mock("@/lib/billing-providers", () => ({ performProviderBillingAction }));
describe("global admin billing actions", () => {
  beforeEach(() => { vi.clearAllMocks(); requireGlobalAdmin.mockResolvedValue({ user: { id: "admin" } }); db.subscription.findUnique.mockResolvedValue({ id: "sub-1", provider: "STRIPE", externalSubscriptionId: "stripe-sub-1", status: "ACTIVE", cancelAtPeriodEnd: false, churchId: "church-1", church: { id: "church-1", name: "Site", slug: "site" }, plan: { name: "Standard" } }); });
  it("returns a confirmation preview without calling the provider", async () => {
    const { executeGlobalBillingAction } = await import("@/lib/global-admin-billing-actions");
    const result = await executeGlobalBillingAction("sub-1", "CANCEL_AT_PERIOD_END", false);
    expect(result).toMatchObject({ confirmationRequired: true, site: { name: "Site" } });
    expect(performProviderBillingAction).not.toHaveBeenCalled();
  });
  it("does not mutate local state when the provider fails", async () => {
    performProviderBillingAction.mockRejectedValue(new Error("Stripe subscription update failed."));
    const { executeGlobalBillingAction } = await import("@/lib/global-admin-billing-actions");
    await expect(executeGlobalBillingAction("sub-1", "CANCEL_AT_PERIOD_END", true)).rejects.toThrow("Stripe subscription update failed.");
    expect(db.subscription.update).not.toHaveBeenCalled();
  });
  it("updates and audits only after a verified provider response", async () => {
    performProviderBillingAction.mockResolvedValue({ status: "ACTIVE", cancelAtPeriodEnd: true });
    db.subscription.update.mockResolvedValue({ id: "sub-1", status: "ACTIVE", cancelAtPeriodEnd: true, provider: "STRIPE" });
    const { executeGlobalBillingAction } = await import("@/lib/global-admin-billing-actions");
    await expect(executeGlobalBillingAction("sub-1", "CANCEL_AT_PERIOD_END", true)).resolves.toMatchObject({ confirmed: true, cancelAtPeriodEnd: true });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ activityType: "billing-subscription-action" }));
  });
});
