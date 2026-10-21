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

  it("supports video media in the widget picker", () => {
    const source = fs.readFileSync("app/admin/pages/widgets/page.tsx", "utf8");

    expect(source).toContain('mediaType="all"');
    expect(source).toContain('asset.mimeType.startsWith("video/")');
    expect(source).toContain("<video controls");
  });
});
