import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageRenderer } from "@/components/page-renderer";

describe("public page headline layout", () => {
  it("preserves headline typography and placement inside a full-height container", async () => {
    const markup = renderToStaticMarkup(await PageRenderer({
      blocks: [
        { id: "headline-1", type: "headline", props: { title: "First", headingLevel: "h1", fontSize: "42px", marginTop: "12", marginLeft: "0", alignment: "left", verticalAlign: "top" } },
        { id: "headline-2", type: "headline", props: { title: "Second", headingLevel: "h2", fontSize: "1.5em", marginTop: "-8", marginLeft: "40", alignment: "left", verticalAlign: "top" } },
      ]
    }));

    expect(markup).toContain("--desktop-font-size:42px");
    expect(markup).toContain("--desktop-font-size:1.5em");
    expect(markup).toContain("margin-top:-8px");
    expect(markup).toContain("margin-left:40px");
    expect(markup).toContain("text-left");
    expect(markup).toContain("text-5xl");
    expect(markup).toContain("text-4xl");
  });
});
