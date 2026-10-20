import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  siteDomain: { findUnique: vi.fn(), create: vi.fn() }
}));
const onePanelPlatformTlsStatus = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn(async () => ({ id: "user-1", churchId: "church-1" })) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/onepanel", () => ({ onePanelPlatformTlsStatus }));

describe("tenant domain creation idempotency", () => {
  it("returns an existing manually activated domain without external provisioning", async () => {
    db.siteDomain.findUnique.mockResolvedValue({
      id: "domain-1",
      churchId: "church-1",
      hostname: "stpaulsmilaca.org",
      kind: "CUSTOM_DOMAIN",
      status: "ACTIVE",
      tlsStatus: "ACTIVE",
      dnsGuidance: "manual",
      verificationToken: null
    });
    const { createTenantDomain } = await import("@/lib/domain-provider");

    await expect(createTenantDomain({ hostname: "stpaulsmilaca.org", kind: "CUSTOM_DOMAIN" })).resolves.toMatchObject({ existing: true, status: "ACTIVE", tlsStatus: "ACTIVE", verificationRecord: null });
    expect(db.siteDomain.create).not.toHaveBeenCalled();
    expect(onePanelPlatformTlsStatus).not.toHaveBeenCalled();
  });
});
