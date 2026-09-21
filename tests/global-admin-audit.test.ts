import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  auditLog: { count: vi.fn(), findMany: vi.fn() },
  church: { findMany: vi.fn() }
}));
vi.mock("@/lib/db", () => ({ db }));

describe("global admin audit query", () => {
  it("normalizes filters, paginates, and omits sensitive metadata", async () => {
    db.auditLog.count.mockResolvedValue(51);
    db.auditLog.findMany.mockResolvedValue([{
      id: "audit-1", activityType: "global-admin-domain-added", summary: "Added domain.",
      details: "safe detail", targetType: "DOMAIN", targetId: "domain-1",
      createdAt: new Date("2026-09-20T12:00:00.000Z"),
      actor: { id: "user-1", name: "Admin", email: "admin@example.com" },
      church: { id: "church-1", name: "St Paul", slug: "st-paul" },
      metadata: { secret: "never returned" }
    }]);
    db.church.findMany.mockResolvedValue([{ id: "church-1", name: "St Paul", slug: "st-paul" }]);
    const { getGlobalAdminAudit } = await import("@/lib/global-admin-audit");
    const result = await getGlobalAdminAudit({ page: 2, pageSize: 100, activityType: "global-admin-domain-added", churchId: "church-1", actor: "Admin", search: "domain", from: "2026-09-01", to: "2026-09-20" });
    expect(db.auditLog.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ activityType: "global-admin-domain-added", churchId: "church-1", actor: expect.anything(), createdAt: expect.anything(), OR: expect.anything() }) }));
    expect(db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 50 }));
    expect(result).toEqual(expect.objectContaining({
      items: [expect.objectContaining({ id: "audit-1", details: "safe detail", site: { id: "church-1", name: "St Paul", slug: "st-paul" } })],
      pagination: { page: 2, pageSize: 50, total: 51, pageCount: 2 },
      sites: [{ id: "church-1", name: "St Paul", slug: "st-paul" }]
    }));
    expect(result.items[0]).not.toHaveProperty("metadata");
  });
});

const requireGlobalAdmin = vi.hoisted(() => vi.fn(async () => ({ user: { id: "admin" } })));
vi.mock("@/lib/global-admin", () => ({ requireGlobalAdmin }));

describe("global admin audit API", () => {
  it("rejects non-global administrators", async () => {
    requireGlobalAdmin.mockRejectedValueOnce(new Error("Unauthorized: global administrator access is required."));
    const { GET } = await import("@/app/api/global-admin/audit/route");
    const response = await GET(new Request("http://localhost/api/global-admin/audit") as never);
    expect(response.status).toBe(403);
  });
});
