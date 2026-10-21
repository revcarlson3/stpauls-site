import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }
}));

vi.mock("@/lib/db", () => ({ db }));

import { createPublicSiteBridgeToken, createPublicSiteSessionToken } from "@/lib/public-site-bridge";

describe("public-site session bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a bridge token on a different tenant hostname", async () => {
    const token = await createPublicSiteBridgeToken({
      userId: "user-1",
      churchId: "church-1",
      hostname: "church.mychurch.one",
      role: "admin",
      canAccessAdmin: true,
      sessionVersion: 3
    });

    await expect(createPublicSiteSessionToken(token, "other.mychurch.one")).resolves.toBeNull();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("creates a public-site session for the same active tenant account", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: "admin",
      isActive: true,
      sessionVersion: 3,
      churchMemberships: [{ churchId: "church-1" }],
      group: { permissions: [{ permission: "MANAGE_SETTINGS" }] }
    });
    const token = await createPublicSiteBridgeToken({
      userId: "user-1",
      churchId: "church-1",
      hostname: "church.mychurch.one",
      role: "admin",
      canAccessAdmin: true,
      sessionVersion: 3
    });

    await expect(createPublicSiteSessionToken(token, "church.mychurch.one")).resolves.toEqual(expect.any(String));
  });

  it("preserves the requested page path through the bridge redirect", () => {
    const bridge = fs.readFileSync(path.resolve(process.cwd(), "app/api/auth/public-site-bridge/route.ts"), "utf8");
    const authBridge = fs.readFileSync(path.resolve(process.cwd(), "app/(public)/auth/bridge/route.ts"), "utf8");

    expect(bridge).toContain('bridgeUrl.searchParams.set("redirect", `${target.pathname}${target.search}`);');
    expect(authBridge).toContain('const redirect = url.searchParams.get("redirect") ?? "/";');
    expect(authBridge).toContain('new URL(redirect, `${protocol}://${host}`)');
    expect(authBridge).toContain('!redirect.startsWith("//")');
  });
});
