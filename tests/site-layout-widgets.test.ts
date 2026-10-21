import { describe, expect, it } from "vitest";
import { normalizeFooterLayout } from "@/lib/site-layout";
import { parseWidgetInput } from "@/lib/widget-input";

describe("footer layout compatibility", () => {
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
