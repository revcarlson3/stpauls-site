import { describe, expect, it } from "vitest";
import { hasPublicWebsiteModuleAccess, PUBLIC_WEBSITE_LINKS } from "@/lib/modules";

describe("public website admin navigation", () => {
  it("requires the enabled module and publish permission", () => {
    expect(hasPublicWebsiteModuleAccess(["public-site"], ["EDIT_PAGES"])).toBe(false);
    expect(hasPublicWebsiteModuleAccess(["public-site"], ["PUBLISH_PAGES"])).toBe(true);
    expect(hasPublicWebsiteModuleAccess([], ["PUBLISH_PAGES"])).toBe(false);
  });

  it("defines one link for each public website management surface", () => {
    expect(PUBLIC_WEBSITE_LINKS.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Pages", href: "/admin/pages" },
      { label: "Media Library", href: "/admin/media" },
      { label: "Menus", href: "/admin/navigation" },
      { label: "Theme", href: "/admin/theme" }
    ]);
  });
});
