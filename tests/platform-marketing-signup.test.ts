import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPlatformHost, isTenantHost, normalizeRequestHost } from "@/lib/platform-host";

describe("platform host routing", () => {
  it("recognizes localhost and configured apex hosts without treating tenant subdomains as apex", () => {
    expect(isPlatformHost("localhost:3000")).toBe(true);
    expect(isPlatformHost("www.mychurch.one")).toBe(true);
    expect(isPlatformHost("beta.mychurch.one")).toBe(true);
    expect(isPlatformHost("church.mychurch.one")).toBe(false);
    expect(isPlatformHost("beta.example.test", { PLATFORM_BASE_HOST: "beta.example.test" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isTenantHost("church.mychurch.one")).toBe(true);
  });

  it("normalizes forwarded host values safely", () => {
    expect(normalizeRequestHost(" Example.org:443, proxy")).toBe("example.org");
    expect(normalizeRequestHost("")).toBe("");
  });
});

describe("platform signup", () => {
  const db = vi.hoisted(() => ({ accountSignup: { create: vi.fn() } }));
  vi.mock("@/lib/db", () => ({ db }));
  vi.mock("@/lib/password-policy", () => ({ validatePassword: vi.fn().mockResolvedValue(null) }));
  it("creates a pending verification record and never creates a user or payment", async () => {
    db.accountSignup.create.mockResolvedValue({ id: "signup-1", email: "owner@example.org", churchName: "Example Church", verificationExpiresAt: new Date("2026-09-24T00:00:00Z") });
    const { createPendingPlatformSignup } = await import("@/lib/platform-signup");
    const result = await createPendingPlatformSignup({ contactName: "Owner", churchName: "Example Church", email: "Owner@example.org", password: "A secure password 123!" });
    expect(result.status).toBe("PENDING_VERIFICATION");
    expect(db.accountSignup.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "owner@example.org", churchName: "Example Church", verificationHash: expect.any(String) }) }));
  });
  it("rejects malformed signup input", async () => {
    db.accountSignup.create.mockClear();
    const { createPendingPlatformSignup } = await import("@/lib/platform-signup");
    await expect(createPendingPlatformSignup({ contactName: "", churchName: "Church", email: "bad", password: "short" })).rejects.toThrow();
    expect(db.accountSignup.create).not.toHaveBeenCalled();
  });
});
