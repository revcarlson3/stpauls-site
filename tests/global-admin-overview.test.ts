import { describe, expect, it, vi } from "vitest";
import { serializeGlobalAdminOverview } from "@/lib/global-admin-overview";

describe("global-admin operational overview serialization", () => {
  it("maps operational records without provider secrets or support descriptions", () => {
    const result = serializeGlobalAdminOverview({
      onboarding: { status: "IN_PROGRESS", currentStep: "MODULES", siteIdentityDone: true, modulesDone: false, securityDone: false, completedAt: null },
      domains: [{ hostname: "site.example", kind: "CUSTOM_DOMAIN", status: "ACTIVE", tlsStatus: "VALID", verifiedAt: new Date("2026-01-02T00:00:00.000Z"), lastCheckedAt: null }],
      subscription: { status: "ACTIVE", provider: "STRIPE", interval: "MONTHLY", currentPeriodEnd: null, cancelAtPeriodEnd: false, plan: { name: "Standard", slug: "standard", currency: "USD" } },
      support: { openCount: 2, recentCount: 3, recentTickets: [{ id: "ticket-1", subject: "Cannot sign in", status: "OPEN", priority: "HIGH", updatedAt: new Date("2026-01-03T00:00:00.000Z") }] },
      announcements: { activeCount: 1, recentCount: 1, recent: [{ id: "delivery-1", title: "Maintenance", severity: "INFO", publishedAt: new Date("2026-01-04T00:00:00.000Z"), acknowledgedAt: null }] }
    });

    expect(result).toEqual({
      onboarding: { status: "IN_PROGRESS", currentStep: "MODULES", completion: { siteIdentity: true, modules: false, security: false, completedAt: null } },
      domains: [{ hostname: "site.example", kind: "CUSTOM_DOMAIN", status: "ACTIVE", tlsStatus: "VALID", verification: { verified: true, verifiedAt: "2026-01-02T00:00:00.000Z", lastCheckedAt: null } }],
      subscription: { status: "ACTIVE", provider: "STRIPE", interval: "MONTHLY", currentPeriodEnd: null, cancelAtPeriodEnd: false, plan: { name: "Standard", slug: "standard", currency: "USD" } },
      support: { openCount: 2, recentCount: 3, recentTickets: [{ id: "ticket-1", subject: "Cannot sign in", status: "OPEN", priority: "HIGH", updatedAt: "2026-01-03T00:00:00.000Z" }] },
      announcements: { activeCount: 1, recentCount: 1, recent: [{ id: "delivery-1", title: "Maintenance", severity: "INFO", publishedAt: "2026-01-04T00:00:00.000Z", acknowledgedAt: null }] }
    });
    expect(JSON.stringify(result)).not.toContain("description");
    expect(JSON.stringify(result)).not.toContain("externalCustomerId");
  });

  it("preserves absent optional records as null and empty collections", () => {
    expect(serializeGlobalAdminOverview({
      onboarding: null,
      domains: [],
      subscription: null,
      support: { openCount: 0, recentCount: 0, recentTickets: [] },
      announcements: { activeCount: 0, recentCount: 0, recent: [] }
    })).toEqual({
      onboarding: null,
      domains: [],
      subscription: null,
      support: { openCount: 0, recentCount: 0, recentTickets: [] },
      announcements: { activeCount: 0, recentCount: 0, recent: [] }
    });
  });
});

const db = vi.hoisted(() => ({
  church: { findUnique: vi.fn() },
  churchUser: { count: vi.fn() },
  tenantOnboarding: { findUnique: vi.fn() },
  siteDomain: { findMany: vi.fn() },
  subscription: { findFirst: vi.fn() },
  supportTicket: { count: vi.fn(), findMany: vi.fn() },
  globalAnnouncementDelivery: { count: vi.fn(), findMany: vi.fn() }
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/global-admin", () => ({ requireGlobalAdmin: vi.fn(async () => ({ church: { id: "church-selected" } })) }));

describe("global-admin operational overview scoping", () => {
  it("passes only the selected church id to every operational query", async () => {
    db.church.findUnique.mockResolvedValue({ name: "Selected", slug: "selected", city: null, state: null, status: "ACTIVE", lifecycleStatus: "ACTIVE", onboardingStatus: "COMPLETE", onboardingStep: null, createdAt: new Date("2026-01-01T00:00:00.000Z") });
    db.churchUser.count.mockResolvedValue(0);
    db.tenantOnboarding.findUnique.mockResolvedValue(null);
    db.siteDomain.findMany.mockResolvedValue([]);
    db.subscription.findFirst.mockResolvedValue(null);
    db.supportTicket.count.mockResolvedValue(0);
    db.supportTicket.findMany.mockResolvedValue([]);
    db.globalAnnouncementDelivery.count.mockResolvedValue(0);
    db.globalAnnouncementDelivery.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/global-admin/overview/route");
    const response = await GET();
    expect(response.status).toBe(200);
    for (const call of [
      db.church.findUnique,
      db.churchUser.count,
      db.tenantOnboarding.findUnique,
      db.siteDomain.findMany,
      db.subscription.findFirst,
      db.supportTicket.count,
      db.supportTicket.findMany,
      db.globalAnnouncementDelivery.count,
      db.globalAnnouncementDelivery.findMany
    ]) {
      expect(call.mock.calls.length).toBeGreaterThan(0);
      expect(call.mock.calls.every(([args]) => args.where.churchId === "church-selected" || args.where.id === "church-selected")).toBe(true);
    }
  });
});
