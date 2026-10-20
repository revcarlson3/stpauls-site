import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  church: { findUnique: vi.fn() },
  siteDomain: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() }
}));
const provisionPlatformDns = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/global-admin", () => ({
  requireGlobalAdmin: vi.fn(async () => ({ user: { id: "admin" }, church: { id: "church-1" } })),
  buildGlobalAuditDetails: vi.fn(() => "details")
}));
vi.mock("@/lib/namecheap", () => ({ provisionPlatformDns }));
vi.mock("@/lib/platform-domain", () => ({ domainDnsGuidance: vi.fn(() => "guidance") }));

describe("manual existing-domain activation", () => {
  it("activates locally without calling Namecheap or 1Panel DNS provisioning", async () => {
    db.church.findUnique.mockResolvedValue({ id: "church-1", name: "Site", slug: "site", lifecycleStatus: "ACTIVE" });
    db.siteDomain.findUnique.mockResolvedValue(null);
    db.siteDomain.create.mockResolvedValue({
      id: "domain-1",
      hostname: "stpaulsmilaca.org",
      kind: "CUSTOM_DOMAIN",
      status: "ACTIVE",
      isPrimary: false,
      verifiedAt: new Date("2026-10-20T00:00:00.000Z"),
      tlsStatus: "ACTIVE",
      dnsManaged: false,
      lastCheckedAt: new Date("2026-10-20T00:00:00.000Z"),
      lastError: null,
      registrarProvider: "MANUAL",
      registrarDetectedAt: new Date("2026-10-20T00:00:00.000Z"),
      dnsGuidance: "manual"
    });
    const { activateExistingSelectedChurchDomain } = await import("@/lib/global-admin-domains");

    await expect(activateExistingSelectedChurchDomain({ hostname: "stpaulsmilaca.org" })).resolves.toMatchObject({ status: "ACTIVE", tlsStatus: "ACTIVE", dnsManaged: false });
    expect(provisionPlatformDns).not.toHaveBeenCalled();
    expect(db.siteDomain.create).toHaveBeenCalled();
  });
});
