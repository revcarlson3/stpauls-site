import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageRenderer, structuralBlockClassName } from "@/components/page-renderer";
import fs from "node:fs";
import path from "node:path";

describe("public page headline layout", () => {
  it("does not add page-shell padding between the header and first page block", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
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

  it("uses responsive grid column variables so mobile layouts collapse to one column", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
    const renderer = fs.readFileSync(path.resolve(process.cwd(), "components/page-renderer.tsx"), "utf8");
    expect(renderer).toContain('"--desktop-columns": String(Math.max(1, Math.min(12, Math.round(columns))))');
    expect(css).toContain(".responsive-grid-content > .site-block-stack {\n  grid-template-columns: repeat(var(--desktop-columns, 1), minmax(0, 1fr));\n  gap: var(--desktop-grid-gap, 1.5rem);\n}");
    expect(css).toContain("grid-template-columns: repeat(var(--tablet-columns, 1), minmax(0, 1fr)) !important;");
    expect(css).toContain("grid-template-columns: repeat(var(--mobile-columns, 1), minmax(0, 1fr)) !important;");
    expect(css).toContain("gap: var(--tablet-grid-gap, 0.75rem) !important;");
    expect(css).toContain("gap: var(--mobile-grid-gap, 0.5rem) !important;");
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

  it("keeps images fluid when only a responsive width is configured", async () => {
    const markup = renderToStaticMarkup(await PageRenderer({
      blocks: [
        {
          id: "image-2",
          type: "image",
          props: {
            imageUrl: "/images/example.png",
            responsive: { mobile: { widthValue: "100", widthUnit: "%" } },
          },
        },
      ],
    }));

    expect(markup).toContain("--mobile-width:100%");
    expect(markup).toContain("width:100%");
    expect(markup).toContain("max-width:100%");
  });

  it("preserves desktop block height on mobile without a mobile override", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
    expect(css).toContain("height: var(--tablet-height, var(--desktop-height, auto)) !important;");
    expect(css).toContain("height: var(--mobile-height, var(--desktop-height, auto)) !important;");
  });

  it("removes default image top spacing and fills grid cells when no explicit image width is set", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
    const renderer = fs.readFileSync(path.resolve(process.cwd(), "components/page-renderer.tsx"), "utf8");
    expect(renderer).toContain("withinGrid && !width ? { width: \"100%\" } : {}");
    expect(renderer).toContain("grid-image-no-default-margin");
    expect(css).toContain(".grid-image-no-default-margin {\n  margin-top: 0;\n}");
  });

  it("allows viewport-triggered images to appear when only part of the image is visible", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "components/image-display.tsx"), "utf8");
    expect(source).toContain("useInView(imageRef, { amount: 0.1, once: false })");
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

  it("applies block typography to rich text headings without removing inline formatting", async () => {
    const markup = renderToStaticMarkup(await PageRenderer({
      blocks: [
        {
          id: "body-1",
          type: "body",
          props: {
            content: "<h1><strong>Welcome</strong></h1><p><em>Details</em></p>",
            fontSize: "32px",
            fontWeight: "600",
            lineHeight: "1.2",
            textItalic: false,
          },
        },
      ],
    }));

    expect(markup).toContain("font-size:32px");
    expect(markup).toMatch(/responsive-content-base[^>]*font-size:32px/);
    expect(markup).toContain("<strong>Welcome</strong>");
    expect(markup).toContain("<em>Details</em>");
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
