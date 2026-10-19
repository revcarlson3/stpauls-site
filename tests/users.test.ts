import { describe, expect, it } from "vitest";
import { buildPublicSiteUrl, isTenantManagedUser, securityGroupScope } from "@/lib/users";

describe("tenant user and security-group boundaries", () => {
  it("excludes platform administrators from tenant management", () => {
    expect(isTenantManagedUser(false)).toBe(true);
    expect(isTenantManagedUser(true)).toBe(false);
  });

  it("builds an exact Church scope for group lookups", () => {
    expect(securityGroupScope("church-a")).toEqual({ churchId: "church-a" });
    expect(securityGroupScope("church-b")).not.toEqual(securityGroupScope("church-a"));
  });

  it("builds an absolute public-site URL only for an active tenant hostname", () => {
    expect(buildPublicSiteUrl("example.mychurch.one")).toBe("https://example.mychurch.one");
    expect(buildPublicSiteUrl(null)).toBeNull();
  });
});
