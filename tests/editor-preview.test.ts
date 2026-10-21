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
});
