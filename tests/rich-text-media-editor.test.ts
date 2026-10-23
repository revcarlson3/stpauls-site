import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("rich text media controls", () => {
  it("keeps media selection, context actions, and resize handling in the shared editor", () => {
    const source = fs.readFileSync("app/admin/editor/editor-canvas.tsx", "utf8");

    expect(source).toContain("onContextMenu");
    expect(source).toContain("Copy media");
    expect(source).toContain("Paste duplicate");
    expect(source).toContain("Delete media");
    expect(source).toContain("beginMediaResize");
    expect(source).toContain("resize.media.style.width");
  });

  it("clears the WYSIWYG to plain text instead of relying on partial browser formatting removal", () => {
    const source = fs.readFileSync("app/admin/editor/editor-canvas.tsx", "utf8");

    expect(source).toContain('command === "clearFormatting"');
    expect(source).toContain("template.content.textContent");
    expect(source).toContain('["clearFormatting", "clear", "Clear formatting"]');
    expect(source).not.toContain('["removeFormat", "clear", "Clear formatting"]');
  });

  it("supports video media in the widget picker", () => {
    const source = fs.readFileSync("app/admin/pages/widgets/page.tsx", "utf8");

    expect(source).toContain('mediaType="all"');
    expect(source).toContain('asset.mimeType.startsWith("video/")');
    expect(source).toContain("<video controls");
  });

  it("gives the widget editor room while keeping live media sizing proportional", () => {
    const widgetSource = fs.readFileSync("app/admin/pages/widgets/page.tsx", "utf8");
    const styleSource = fs.readFileSync("app/globals.css", "utf8");

    expect(widgetSource).toContain("lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]");
    expect(styleSource).toMatch(/\.rich-text-editor img,\s*\.rich-text-editor video \{[\s\S]*?max-width: 100%;[\s\S]*?height: auto;/);
    expect(styleSource).toMatch(/\.rich-text-content img,\s*\.rich-text-content video \{[\s\S]*?display: block;[\s\S]*?max-width: 100%;[\s\S]*?height: auto;/);
  });
});
