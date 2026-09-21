import { describe, expect, it, vi } from "vitest";
import { getGlobalAdminOperations } from "@/lib/global-admin-operations";

const db = vi.hoisted(() => ({
  church: { groupBy: vi.fn() },
  user: { count: vi.fn() },
  supportTicket: { count: vi.fn() },
  globalAnnouncement: { count: vi.fn() },
  siteDomain: { count: vi.fn(), groupBy: vi.fn() },
  auditLog: { findMany: vi.fn() }
}));

vi.mock("@/lib/db", () => ({ db }));

describe("global admin operations aggregation", () => {
  it("aggregates platform-wide counts and serializes recent audit activity", async () => {
    db.church.groupBy.mockResolvedValueOnce([{ lifecycleStatus: "ACTIVE", _count: { _all: 2 } }, { lifecycleStatus: "SUSPENDED", _count: { _all: 1 } }]).mockResolvedValueOnce([{ onboardingStatus: "COMPLETE", _count: { _all: 2 } }, { onboardingStatus: "IN_PROGRESS", _count: { _all: 1 } }]);
    db.user.count.mockResolvedValue(8);
    db.supportTicket.count.mockResolvedValue(3);
    db.globalAnnouncement.count.mockResolvedValue(2);
    db.siteDomain.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    db.siteDomain.groupBy.mockResolvedValueOnce([{ status: "ACTIVE", _count: { _all: 3 } }, { status: "FAILED", _count: { _all: 1 } }]).mockResolvedValueOnce([{ tlsStatus: "VALID", _count: { _all: 2 } }, { tlsStatus: null, _count: { _all: 2 } }]);
    db.auditLog.findMany.mockResolvedValue([{ id: "audit-1", activityType: "global-admin-domain-added", summary: "Added domain.", createdAt: new Date("2026-01-01T00:00:00.000Z"), actor: { name: "Admin", email: "admin@example.com" } }]);

    await expect(getGlobalAdminOperations(new Date("2026-01-02T00:00:00.000Z"))).resolves.toEqual({
      sites: { total: 3, byLifecycle: { ACTIVE: 2, SUSPENDED: 1 } },
      onboarding: { total: 3, byStatus: { COMPLETE: 2, IN_PROGRESS: 1 } },
      users: { total: 8 },
      support: { open: 3 },
      announcements: { active: 2 },
      domains: { total: 4, verified: 3, unverified: 1, byStatus: { ACTIVE: 3, FAILED: 1 }, byTlsStatus: { VALID: 2, NOT_REPORTED: 2 } },
      recentAuditActivity: [{ id: "audit-1", activityType: "global-admin-domain-added", summary: "Added domain.", createdAt: "2026-01-01T00:00:00.000Z", actor: "Admin" }]
    });
    expect(db.supportTicket.count).toHaveBeenCalledWith({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_TENANT"] } } });
  });
});

const requireGlobalAdmin = vi.hoisted(() => vi.fn(async () => ({ user: { id: "admin" } })));
vi.mock("@/lib/global-admin", () => ({ requireGlobalAdmin }));

describe("global admin operations API", () => {
  it("rejects requests without global administrator access", async () => {
    requireGlobalAdmin.mockRejectedValueOnce(new Error("Unauthorized: global administrator access is required."));
    const { GET } = await import("@/app/api/global-admin/operations/route");
    const response = await GET();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Global administrator access is required." });
  });
});
