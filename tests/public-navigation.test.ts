import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public navigation styling and interaction", () => {
  it("uses larger, more spacious dropdown navigation with nested placement", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "components/menu-links.tsx"), "utf8");

    expect(source).toContain("lg:min-w-64");
    expect(source).toContain("lg:shadow-xl");
    expect(source).toContain("text-base");
    expect(source).toContain('depth > 0 ? "lg:left-full lg:top-0 lg:ml-2"');
  });

  it("opens the membership menu from hover and closes when the pointer leaves", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "components/responsive-public-nav.tsx"), "utf8");

    expect(source).toContain("onMouseEnter={() => setMembershipOpen(true)}");
    expect(source).toContain("onMouseLeave={() => setMembershipOpen(false)}");
    expect(source).not.toContain("onClick={() => setMembershipOpen");
    expect(source).toContain('href="/account/membership/documents"');
  });

  it("supports independently assigning authenticated links to multiple menus", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "components/responsive-public-nav.tsx"), "utf8");
    expect(source).toContain("accountMenuIds");
    expect(source).toContain("membershipMenuIds");
    expect(source).toContain("logoutMenuIds");
    expect(source).toContain("notificationMenuIds");
    expect(source).toContain("configuredMenuIds.includes(menuId)");
    expect(source).toContain("isMainNavigation");
  });

  it("keeps pre-header text separate from secondary-menu alignment", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "components/site-header.tsx"), "utf8");
    expect(source).toContain("site-header-preheader-content min-w-0 flex-1");
    expect(source).toContain("preHeaderMenuAlignment");
    expect(source).toContain("flex min-w-0 flex-1 flex-wrap items-center");
  });
});
