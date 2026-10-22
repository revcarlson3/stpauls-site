import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production notification worker configuration", () => {
  it("enables the Next.js instrumentation hook", () => {
    const nextConfig = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    expect(nextConfig).toContain("instrumentationHook: true");
  });
});
