import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("page editor site preview target", () => {
  it("resolves the edited page path in the shared admin shell", () => {
    const layout = fs.readFileSync(path.resolve(process.cwd(), "app/admin/layout.tsx"), "utf8");
    const editor = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");

    expect(layout).toContain('fetch(`/api/pages/${encodeURIComponent(editorPageMatch[1])}`)');
    expect(layout).toContain('page.isHome ? "/" : `/${encodeURIComponent(page.slug)}`');
    expect(layout).toContain('const publicSiteTarget = publicSiteUrl ? `${publicSiteUrl.replace(/\\/$/, "")}${publicSitePagePath ?? ""}` : null;');
    expect(editor).toContain('new CustomEvent("page-editor-saved"');
  });

  it("continuously measures dynamic insertion zones while dragging", () => {
    const editor = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");

    expect(editor).toContain("measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}");
  });

  it("persists image links and exposes expanded image animations", () => {
    const editor = fs.readFileSync(path.resolve(process.cwd(), "app/admin/editor/editor-canvas.tsx"), "utf8");
    const renderer = fs.readFileSync(path.resolve(process.cwd(), "components/page-renderer.tsx"), "utf8");
    const display = fs.readFileSync(path.resolve(process.cwd(), "components/image-display.tsx"), "utf8");

    expect(editor).toContain("imageLinkUrl");
    expect(editor).toContain('placeholder="/about or https://example.com"');
    expect(editor).toContain('value="bounce">Bounce</option>');
    expect(renderer).toContain("linkUrl={typeof block.props.imageLinkUrl === \"string\" ? block.props.imageLinkUrl : \"\"}");
    expect(display).toContain("safeLinkUrl");
    expect(display).toContain('rel={linkTarget === "_blank" ? "noreferrer" : undefined}');
    expect(display).toContain("amount: 0.65");
    expect(display).toContain('from "motion/react"');
    expect(display).toContain("type: \"spring\"");
  });
});
