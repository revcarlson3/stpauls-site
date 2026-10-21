import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("stylistic header scroll treatment", () => {
  it("adds extra transparency to the styled header after scrolling", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
    const frame = fs.readFileSync(path.resolve(process.cwd(), "components/site-header-frame.tsx"), "utf8");

    expect(css).toContain(".site-header.is-stylistic.is-scrolled {\n  opacity: 0.82;\n}");
    expect(frame).toContain('stylistic && scrolled ? "is-stylistic is-scrolled"');
    expect(frame).toContain("setScrolled(window.scrollY > 8)");
  });

  it("uses the configured main-header height and collapses a sticky pre-header", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
    expect(css).toContain(".site-header-main {\n  min-height: var(--site-header-min-height);\n}");
    expect(css).toContain(".site-header.is-sticky.is-scrolled .site-header-preheader");
  });
});
