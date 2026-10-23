import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageRenderer, structuralBlockClassName } from "@/components/page-renderer";
import fs from "node:fs";
import path from "node:path";

describe("public page headline layout", () => {
  it("does not add page-shell padding between the header and first page block", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    expect(css.replace(/\r\n/g, "\n")).toContain(".site-public-content.site-section {\n  padding-block: 0;\n}");
    expect(css.replace(/\r\n/g, "\n")).toContain(".site-block-stack {\n  gap: 0;\n}");
  });

  it("preserves headline typography and placement inside a full-height container", async () => {
    const markup = renderToStaticMarkup(await PageRenderer({
      blocks: [
        { id: "headline-1", type: "headline", props: { title: "First", headingLevel: "h1", fontSize: "42px", marginTop: "12", marginLeft: "0", alignment: "left", verticalAlign: "top" } },
        { id: "headline-2", type: "headline", props: { title: "Second", headingLevel: "h2", fontSize: "1.5em", marginTop: "-8", marginLeft: "40", alignment: "left", verticalAlign: "top" } },
      ]
    }));

    expect(markup).toContain("--desktop-font-size:42px");
    expect(markup).toContain("--desktop-font-size:1.5em");
    expect(markup).toContain("font-size:42px");
    expect(markup).toContain("font-size:1.5em");
    expect(markup).toContain("margin-top:-8px");
    expect(markup).toContain("margin-left:40px");
    expect(markup).toContain("text-left");
    expect(markup).toContain("text-5xl");
    expect(markup).toContain("text-4xl");
    expect(markup).toContain("grid-auto-rows:max-content");
    expect(markup).toContain("align-content:start");
  });

  it("does not add live-only padding to a zero-padding full-width container", () => {
    const className = structuralBlockClassName("container", "p-0", "text-left", "");

    expect(className).toContain("site-layout-container");
    expect(className).toContain("box-border");
    expect(className).toContain("w-full");
    expect(className).toContain("p-0");
    expect(className).not.toContain("p-5");
  });

  it("does not add implicit padding when a block has no padding setting", () => {
    const className = structuralBlockClassName("container", "p-0", "text-left", "");
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");

    expect(className).toContain("p-0");
    expect(css).toContain("padding-top: var(--desktop-padding-top, var(--desktop-padding, 0));");
  });

  it("keeps image dimensions and margins on the live block wrapper", async () => {
    const markup = renderToStaticMarkup(await PageRenderer({
      blocks: [
        {
          id: "image-1",
          type: "image",
          props: {
            imageUrl: "/api/media/upload?file=image.png",
            widthValue: "75",
            widthUnit: "%",
            heightValue: "240",
            heightUnit: "px",
            marginLeft: "12",
            marginBottom: "8",
          },
        },
      ],
    }));

    expect(markup).toContain("width:75%");
    expect(markup).toContain("height:240px");
    expect(markup).toContain("margin-left:12px");
    expect(markup).toContain("margin-bottom:8px");
    expect(markup).toContain("box-sizing:border-box");
    expect(markup).toContain("align-self:flex-start");
    expect(markup).toContain("responsive-image-container");
    expect(markup).toContain("--desktop-width:75%");
    expect(markup).toContain("--desktop-height:240px");
  });

  it("keeps map height changes when the saved unit is omitted", async () => {
    const markup = renderToStaticMarkup(await PageRenderer({
      blocks: [
        {
          id: "map-1",
          type: "map",
          props: { mapAddress: "1 Main Street", mapProvider: "google", heightValue: "480" },
        },
      ],
    }));

    expect(markup).toContain("height:480px");
    expect(markup).toContain("display:block");
  });

  it("renders divider shapes and responsive spacer heights", async () => {
    const markup = renderToStaticMarkup(await PageRenderer({
      blocks: [
        {
          id: "divider-1",
          type: "divider",
          props: {
            dividerColor: "#c85c42",
            dividerThickness: "4",
            dividerWidth: "60",
            dividerAlignment: "right",
            dividerShape: "wave",
            responsive: { mobile: { dividerShape: "dotted", dividerWidth: "80" } },
          },
        },
        {
          id: "spacer-1",
          type: "spacer",
          props: { spacerHeight: "72", responsive: { mobile: { spacerHeight: "24" } } },
        },
      ],
    }));

    expect(markup).toContain("role=\"separator\"");
    expect(markup).toContain("radial-gradient(ellipse");
    expect(markup).toContain("width:60%");
    expect(markup).toContain("responsive-content-has-mobile");
    expect(markup).toContain("height:72px");
    expect(markup).toContain("height:24px");
  });
});
