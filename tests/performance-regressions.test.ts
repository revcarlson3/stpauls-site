import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("performance regressions", () => {
  it("does not reload the full page block payload for widget page options", () => {
    const widgetsPage = fs.readFileSync(path.resolve(process.cwd(), "app/admin/pages/widgets/page.tsx"), "utf8");
    const content = fs.readFileSync(path.resolve(process.cwd(), "lib/content.ts"), "utf8");

    expect(widgetsPage).toContain('fetch("/api/widgets/page-options")');
    expect(content).toContain("export async function listPageOptions()");
    expect(content).toContain("select: { id: true, title: true, slug: true }");
  });

  it("does not refetch admin context on every pathname change", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "app/admin/layout.tsx"), "utf8");

    expect(source).toContain("const adminContextLoadedRef = useRef(false);");
    expect(source).toContain("adminContextLoadedRef.current = true;");
    expect(source).toContain("}, [pathname]);");
    expect(source).toContain("if (pathname === \"/admin/login\" || adminContextLoadedRef.current) return;");
  });

  it("defers background video sources and only enables responsive variants on their device", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "components/lazy-background-video.tsx"), "utf8");
    const renderer = fs.readFileSync(path.resolve(process.cwd(), "components/page-renderer.tsx"), "utf8");

    expect(source).toContain("src={enabled ? src : undefined}");
    expect(source).toContain("preload=\"metadata\"");
    expect(renderer).toContain("mediaQuery={device === \"tablet\"");
  });
});
