import { describe, expect, it } from "vitest";
import { normalizeFooterLayout } from "@/lib/site-layout";
import { isAllowedFaviconUrl } from "@/lib/site-identity-url";
import { decodeTextEntities } from "@/lib/text-entities";
import { parseWidgetInput } from "@/lib/widget-input";

describe("footer layout compatibility", () => {
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
