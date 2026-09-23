import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPlatformHost } from "@/lib/platform-host";

describe("platform domain operations", () => {
  it("keeps platform maintenance independent from tenant hosts", () => {
    expect(isPlatformHost("localhost:3000")).toBe(true);
    expect(isPlatformHost("beta.mychurch.one")).toBe(true);
    expect(isPlatformHost("site-123.mychurch.one")).toBe(false);
  });

  it("preserves custom-domain-over-platform resolution", async () => {
    const dbDomain = vi.hoisted(() => ({ siteDomain: { findFirst: vi.fn() } }));
    vi.doMock("@/lib/db", () => ({ db: dbDomain }));
    dbDomain.siteDomain.findFirst.mockResolvedValueOnce({ church: { id: "custom", slug: "custom", name: "Custom", status: "ACTIVE", publicSiteEnabled: true, maintenanceMode: true } });
    const { resolvePublicTenant } = await import("@/lib/platform-domain");
    await expect(resolvePublicTenant("example.org")).resolves.toMatchObject({ id: "custom", maintenanceMode: true });
    expect(dbDomain.siteDomain.findFirst).toHaveBeenCalledTimes(1);
  });

  it("returns actionable guidance when Namecheap is not configured", async () => {
    const dbNamecheap = vi.hoisted(() => ({ namecheapConfiguration: { findUnique: vi.fn() } }));
    vi.doMock("@/lib/db", () => ({ db: dbNamecheap }));
    const requireGlobalAdmin = vi.fn(async () => ({ user: { id: "admin" } }));
    vi.doMock("@/lib/global-admin", () => ({ requireGlobalAdmin, buildGlobalAuditDetails: vi.fn(() => "details") }));
    dbNamecheap.namecheapConfiguration.findUnique.mockResolvedValue(null);
    const { namecheapStatus, provisionPlatformDns } = await import("@/lib/namecheap");
    await expect(namecheapStatus()).resolves.toMatchObject({ configured: false });
    expect(requireGlobalAdmin).toHaveBeenCalledWith();
    await expect(provisionPlatformDns("site-123.mychurch.one")).resolves.toMatchObject({ state: "UNAVAILABLE" });
  });
});
