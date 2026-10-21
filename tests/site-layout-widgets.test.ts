import { describe, expect, it } from "vitest";
import { defaultHeaderLayout } from "@/lib/site-layout-types";
import { normalizeFooterLayout, normalizeHeaderLayout } from "@/lib/site-layout";
import { orderMenuItems, orderPagesByMenus } from "@/lib/menu-input";
import { isAllowedFaviconUrl } from "@/lib/site-identity-url";
import { decodeTextEntities } from "@/lib/text-entities";
import { parseWidgetInput } from "@/lib/widget-input";
import { sanitizeRichTextHtml } from "@/lib/safe-html";

describe("footer layout compatibility", () => {
  it("keeps legacy headers compatible while preserving pre-header settings", () => {
    expect(normalizeHeaderLayout({ height: "tall", menuId: "main" })).toEqual({
      ...defaultHeaderLayout,
      height: "tall",
      menuId: "main"
    });
    expect(normalizeHeaderLayout({
      height: "standard",
      preHeader: { enabled: true, background: "#123456", height: "tall", html: "<strong>Call us</strong>", menuId: "utility" }
    }).preHeader).toEqual({ enabled: true, background: "#123456", height: "tall", fontSize: "standard", alignment: "right", html: "<strong>Call us</strong>", menuId: "utility" });
    expect(normalizeHeaderLayout({ accountMenuIds: ["menu-a", "menu-a"], membershipMenuIds: ["menu-b"], logoutMenuIds: [] })).toMatchObject({
      accountMenuIds: ["menu-a"],
      membershipMenuIds: ["menu-b"],
      logoutMenuIds: []
    });
    expect(normalizeHeaderLayout({ notificationMenuIds: ["menu-c"], preHeader: { enabled: true, alignment: "center", fontSize: "large" } })).toMatchObject({
      notificationMenuIds: ["menu-c"],
      preHeader: { alignment: "center", fontSize: "large" }
    });
  });

  it("orders pages by menu hierarchy and puts unlinked pages last", () => {
    const ordered = orderPagesByMenus(
      [
        { id: "orphan", title: "Orphan", slug: "orphan", menuId: null, isHome: false },
        { id: "child", title: "Child", slug: "child", menuId: "main", isHome: false },
        { id: "parent", title: "Parent", slug: "parent", menuId: "main", isHome: false }
      ],
      [{
        id: "main",
        items: [
          { id: "parent-item", parentId: null, position: 0, href: "/parent" },
          { id: "child-item", parentId: "parent-item", position: 1, href: "/child" }
        ]
      }]
    );

    expect(ordered.map(({ page, depth, inMenu }) => [page.id, depth, inMenu])).toEqual([
      ["parent", 0, true],
      ["child", 1, true],
      ["orphan", 0, false]
    ]);
  });

  it("uses menu links as the source of truth even when legacy page menu IDs are empty", () => {
    const ordered = orderPagesByMenus(
      [
        { id: "z-page", title: "Z page", slug: "z-page", menuId: null, isHome: false },
        { id: "a-page", title: "A page", slug: "a-page", menuId: null, isHome: false }
      ],
      [{
        id: "primary",
        items: [
          { id: "z-item", parentId: null, position: 0, href: "/z-page" },
          { id: "a-item", parentId: null, position: 1, href: "/a-page" }
        ]
      }]
    );

    expect(ordered.map(({ page, inMenu }) => [page.id, inMenu])).toEqual([
      ["z-page", true],
      ["a-page", true]
    ]);
  });

  it("keeps parent-only menu pages with their submenu branch", () => {
    const ordered = orderPagesByMenus(
      [
        { id: "beliefs", title: "Beliefs", slug: "beliefs", menuId: null, isHome: false },
        { id: "confession", title: "Confession of Faith", slug: "confession-of-faith", menuId: null, isHome: false },
        { id: "home", title: "Home", slug: "home", menuId: null, isHome: true }
      ],
      [{
        id: "about",
        items: [
          { id: "beliefs-item", label: "Beliefs", parentId: null, position: 0, href: "" },
          { id: "confession-item", label: "Confession of Faith", parentId: "beliefs-item", position: 1, href: "/confession-of-faith" }
        ]
      }]
    );

    expect(ordered.map(({ page, depth }) => [page.id, depth])).toEqual([
      ["beliefs", 0],
      ["confession", 1],
      ["home", 0]
    ]);
  });

  it("normalizes legacy pre-header text and sanitizes unsafe HTML", () => {
    expect(normalizeHeaderLayout({
      preHeader: { enabled: true, text: "Call us", menuId: "utility" }
    }).preHeader.html).toBe("Call us");
    expect(sanitizeRichTextHtml('<strong>Call</strong><script>alert(1)</script><a href="javascript:alert(1)">us</a>')).toBe("<strong>Call</strong><a>us</a>");
  });

  it("decodes text entities in footer legal and credit text", () => {
    expect(decodeTextEntities("&copy; 2026 St. Paul's &amp; Friends")).toBe("© 2026 St. Paul's & Friends");
    expect(decodeTextEntities("&#169; &#xA9;")).toBe("© ©");
    expect(decodeTextEntities("&unknown;")).toBe("&unknown;");
  });

  describe("favicon asset URL compatibility", () => {
    it("accepts tenant-qualified media URLs produced by the Media Library", () => {
      expect(isAllowedFaviconUrl("/api/media/upload?tenant=church-1&file=icon.png", "church-1")).toBe(true);
      expect(isAllowedFaviconUrl("/api/media/upload?file=icon.png", "church-1")).toBe(true);
      expect(isAllowedFaviconUrl("/uploads/site-identity/church-1/favicon-icon.svg", "church-1")).toBe(true);
    });

    describe("menu builder hierarchy ordering", () => {
      it("places children under their selected parent regardless of flat positions", () => {
        const ordered = orderMenuItems([
          { id: "parent-a", label: "Parent A", parentId: null, position: 0 },
          { id: "parent-b", label: "Parent B", parentId: null, position: 1 },
          { id: "child-a", label: "Child A", parentId: "parent-a", position: 2 },
          { id: "grandchild-a", label: "Grandchild A", parentId: "child-a", position: 3 }
        ]);

        expect(ordered.map(({ item, depth }) => [item.id, depth])).toEqual([
          ["parent-a", 0],
          ["child-a", 1],
          ["grandchild-a", 2],
          ["parent-b", 0]
        ]);
      });
    });

    it("rejects favicon URLs that point outside the current church", () => {
      expect(isAllowedFaviconUrl("/api/media/upload?tenant=church-2&file=icon.png", "church-1")).toBe(false);
      expect(isAllowedFaviconUrl("/uploads/site-identity/church-2/favicon-icon.svg", "church-1")).toBe(false);
      expect(isAllowedFaviconUrl("https://example.com/icon.png", "church-1")).toBe(false);
    });
  });

  it("defaults legacy columns to left alignment without dividers", () => {
    const footer = normalizeFooterLayout({
      background: "#123456",
      textColor: "#ffffff",
      style: "columns",
      copyright: "",
      credit: "",
      columns: [{ heading: "Links", widgetId: "menu-1" }, { heading: "", widgetId: null }]
    });

    expect(footer.columnDividers).toBe(false);
    expect(footer.columns).toEqual([
      { heading: "Links", widgetId: "menu-1", alignment: "left" },
      { heading: "", widgetId: null, alignment: "left" }
    ]);
  });

  it("preserves supported column alignment and divider settings", () => {
    const footer = normalizeFooterLayout({
      style: "columns",
      columnDividers: true,
      columns: [
        { heading: "", widgetId: null, alignment: "center" },
        { heading: "", widgetId: null, alignment: "right" }
      ]
    });

    expect(footer.columnDividers).toBe(true);
    expect(footer.columns.map((column) => column.alignment)).toEqual(["center", "right"]);
  });
});

describe("widget content input", () => {
  it("keeps rich HTML content including inserted media", () => {
    const input = parseWidgetInput({
      name: "Footer welcome",
      type: "text",
      area: "footer",
      config: { content: '<p>Welcome</p><img src="/api/media/upload?file=welcome.png" alt="Welcome" />' }
    });

    expect(input?.config.content).toContain("<img");
    expect(input?.config.content).toContain("welcome.png");
  });
});
