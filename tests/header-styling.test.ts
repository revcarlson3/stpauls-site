import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("stylistic header scroll treatment", () => {
  it("adds extra transparency only to the styled header while scrolling up", () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
    const frame = fs.readFileSync(path.resolve(process.cwd(), "components/site-header-frame.tsx"), "utf8");

    expect(css).toContain(".site-header.is-stylistic.is-scrolling-up {\n  opacity: 0.82;\n}");
    expect(frame).toContain('stylistic && scrollingUp ? "is-stylistic is-scrolling-up"');
  });
});
