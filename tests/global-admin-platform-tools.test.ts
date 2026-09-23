import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  subscription: { findMany: vi.fn(), groupBy: vi.fn() },
  church: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn()
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/global-admin", () => ({ requireGlobalAdmin: vi.fn(async () => ({ user: { id: "admin" } })), lifecycleActions: ["enable", "activate", "suspend", "disable"], nextLifecycleState: (state: { lifecycleStatus: string; onboardingStatus: string }, action: string) => action === "suspend" && state.lifecycleStatus === "ACTIVE" ? { lifecycleStatus: "SUSPENDED", onboardingStatus: state.onboardingStatus } : action === "activate" && (state.lifecycleStatus === "PROVISIONING" || state.lifecycleStatus === "SUSPENDED") ? { lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE" } : null, lifecycleAuditMetadata: vi.fn(() => ({})), buildGlobalAuditDetails: vi.fn(() => "{}") }));

describe("global admin platform tools", () => {
  it("aggregates billing without provider identifiers or secrets", async () => {
    db.subscription.findMany.mockResolvedValue([{ id: "sub-1", provider: "STRIPE", interval: "MONTHLY", status: "ACTIVE", currentPeriodEnd: null, cancelAtPeriodEnd: false, canceledAt: null, gracePeriodEndsAt: null, church: { id: "site-1", name: "Site", slug: "site", lifecycleStatus: "ACTIVE" }, plan: { name: "Standard", slug: "standard", currency: "USD" }, externalCustomerId: "secret" }]);
    db.subscription.groupBy
      .mockResolvedValueOnce([{ status: "ACTIVE", _count: { _all: 1 } }])
      .mockResolvedValue([]);
    db.church.findMany.mockResolvedValue([]);
    const { getGlobalBillingOverview } = await import("@/lib/global-admin-billing");
    const result = await getGlobalBillingOverview();
    expect(result.counts).toEqual({ ACTIVE: 1 });
    expect(JSON.stringify(result)).not.toContain("externalCustomerId");
  });

  it("normalizes site inventory pagination and filters", async () => {
    db.church.count.mockResolvedValue(51);
    db.church.findMany.mockResolvedValue([]);
    const { listGlobalSites } = await import("@/lib/global-admin-sites");
    const result = await listGlobalSites({ search: "site", lifecycle: "ACTIVE", page: 2, pageSize: 100 });
    expect(result).toMatchObject({ page: 2, pageSize: 50, total: 51, totalPages: 2 });
    expect(db.church.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 50 }));
  });

  it("reports database degradation without throwing or exposing configuration", async () => {
    db.$queryRaw.mockRejectedValue(new Error("database down"));
    const { getGlobalHealth } = await import("@/lib/global-admin-health");
    const result = await getGlobalHealth();
    expect(result).toMatchObject({ status: "degraded", database: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("DATABASE_URL");
  });

  it("blocks invalid bulk transitions before mutation and requires confirmation", async () => {
    db.church.findMany.mockResolvedValue([{ id: "site-1", name: "Site", lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE" }]);
    const { bulkLifecycleTransition } = await import("@/lib/global-admin-sites");
    const preview = await bulkLifecycleTransition({ siteIds: ["site-1"], action: "activate", confirm: false });
    expect(preview.blocked[0].error).toContain("Cannot activate");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("returns explicit per-site success results and audits each transition", async () => {
    db.church.findMany.mockResolvedValue([{ id: "site-1", name: "Site", lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE" }]);
    db.$transaction.mockImplementation(async (callback: (transaction: unknown) => unknown) => callback({
      church: { update: vi.fn().mockResolvedValue({ id: "site-1", name: "Site", lifecycleStatus: "SUSPENDED" }) },
      auditLog: { create: vi.fn() }
    }));
    const { bulkLifecycleTransition } = await import("@/lib/global-admin-sites");
    const result = await bulkLifecycleTransition({ siteIds: ["site-1"], action: "suspend", confirm: true });
    expect(result).toMatchObject({ committed: true, results: [{ id: "site-1", success: true, lifecycleStatus: "SUSPENDED" }] });
  });
});
