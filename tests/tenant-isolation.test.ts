import { describe, expect, it } from "vitest";
import { mediaServeUrl } from "@/lib/media";
import { siteIdentityAssetUrl } from "@/lib/site-identity";
import { tenantOwnsResource } from "@/lib/tenant";

describe("tenant-bound public assets", () => {
  it("binds media URLs to their owning tenant", () => {
    const url = mediaServeUrl("asset.png", "church-a");
    expect(url).toBe("/api/media/upload?tenant=church-a&file=asset.png");
    expect(url).not.toBe(mediaServeUrl("asset.png", "church-b"));
  });

  it("binds identity asset URLs to their owning tenant", () => {
    const url = siteIdentityAssetUrl("/uploads/site-identity/church-a/logo.png", "church-a");
    expect(url).toContain("tenant=church-a");
    expect(url).not.toContain("tenant=church-b");
  });

  it("rejects resources resolved for a different tenant", () => {
    expect(tenantOwnsResource("church-a", "church-a")).toBe(true);
    expect(tenantOwnsResource("church-a", "church-b")).toBe(false);
    expect(tenantOwnsResource(null, "church-a")).toBe(false);
  });
});
