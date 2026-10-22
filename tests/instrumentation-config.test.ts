import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

describe("production notification worker configuration", () => {
  it("enables the Next.js instrumentation hook", () => {
    expect(nextConfig.experimental?.instrumentationHook).toBe(true);
  });
});
